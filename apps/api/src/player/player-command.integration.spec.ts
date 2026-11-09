import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { CAMP_CHEST_ITEMS } from '@hexoflat/engine/inventory/stash-constants';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { Db } from '../db/db.module';
import { commandJournal, heroAggregates, heroes, itemLedger } from '../db/schema';
import { PlayerCommandError } from './player-command.types';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const COINS = HEXOBJECT_KEYS.COINS;

describe.skipIf(!dbAvailable)('player command pipeline (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  const inventoryOf = async (heroId: string) => {
    const snapshot = await kit.service.snapshot(
      (await kit.db.select().from(heroes).where(eq(heroes.id, heroId)))[0].userId,
      heroId,
    );
    return snapshot.aggregates.inventory!;
  };
  const coinsHeld = (inventory: { state: unknown }) => {
    const state = inventory.state as InventoryState;
    return [...state.bag, ...Object.values(state.equip), ...state.stash.cells]
      .filter((cell) => cell?.key === COINS)
      .reduce((sum, cell) => sum + (cell?.amount ?? 0), 0);
  };
  const devGrant = (heroId: string, revision: number, amount: number, commandId?: string) =>
    envelope(heroId, 'DEV_GRANT_ITEM', { key: COINS, amount }, revision, { commandId });

  it('creates a hero with every aggregate empty and hides the server secrets', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const snapshot = await kit.service.snapshot(userId, heroId);
    expect(Object.keys(snapshot.aggregates).sort()).toEqual(['inventory', 'progress']);
    const inventory = snapshot.aggregates.inventory!;
    expect(coinsHeld(inventory)).toBe(0);
    expect((inventory.state as InventoryState).stash.chests).toBe(0);
    expect(snapshot.aggregates.progress!.state).toMatchObject({
      claimedRewards: [],
      presence: null,
      steps: 0,
    });

    const [row] = await kit.db
      .select()
      .from(heroAggregates)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    expect((row.serverState as { rngSeed?: string }).rngSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(snapshot)).not.toContain(
      (row.serverState as { rngSeed: string }).rngSeed,
    );
  });

  it('never creates two heroes for one account, even from parallel first requests', async () => {
    const { userId } = await kit.newPlayer();
    const [fresh] = await kit.db
      .insert((await import('../db/schema')).users)
      .values({ username: `p-${randomUUID()}`, password: 'x', name: 'Racer' })
      .returning({ id: (await import('../db/schema')).users.id });
    const created = await Promise.all(
      Array.from({ length: 6 }, () => kit.heroes.findOrCreateByUserId(fresh.id)),
    );
    expect(new Set(created.map((hero) => hero.id)).size).toBe(1);
    expect(userId).not.toBe(fresh.id);
  });

  it('picks the oldest hero that is not deleted as the current one', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const [first] = await kit.db.select().from(heroes).where(eq(heroes.id, heroId));
    const [second] = await kit.db
      .insert(heroes)
      .values({ userId, name: 'Second', data: first.data })
      .returning({ id: heroes.id });
    expect((await kit.heroes.findByUserId(userId))?.id).toBe(heroId);
    await kit.db
      .update(heroes)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(heroes.id, heroId));
    expect((await kit.heroes.findByUserId(userId))?.id).toBe(second.id);
    expect(await kit.heroes.findOwned(heroId, userId)).toBeNull();
  });

  it('opens the camp chest once, writes a journal row and a ledger row per item', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const first = await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    expect(first.result).toBe('applied');
    expect(first.aggregates.inventory!.revision).toBe(1);
    expect(first.aggregates.progress!.state).toMatchObject({
      claimedRewards: ['camp-first-chest'],
    });

    const again = await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 1));
    expect(again).toMatchObject({ result: 'rejected', code: 'ALREADY_CLAIMED' });

    const ledger = await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId));
    expect(ledger.map((row) => row.itemKey).sort()).toEqual([...CAMP_CHEST_ITEMS].sort());
    expect(ledger.every((row) => row.delta === 1 && row.balanceAfter === 1)).toBe(true);
    expect(ledger.every((row) => row.reason === 'reward')).toBe(true);

    const journal = await kit.db
      .select()
      .from(commandJournal)
      .where(eq(commandJournal.heroId, heroId));
    expect(journal.map((row) => row.result).sort()).toEqual(['applied', 'rejected']);
  });

  it('applies a repeated commandId once and answers the repeat from the journal', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const commandId = randomUUID();
    const a = await kit.service.execute(userId, devGrant(heroId, 0, 5, commandId));
    const b = await kit.service.execute(userId, devGrant(heroId, 0, 5, commandId));
    expect(a.result).toBe('applied');
    expect(b).toMatchObject({ result: 'applied', replayed: true });
    expect(coinsHeld(await inventoryOf(heroId))).toBe(5);
    const ledger = await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId));
    expect(ledger).toHaveLength(1);
  });

  it('refuses another account re-using a commandId', async () => {
    const mine = await kit.newPlayer();
    const other = await kit.newPlayer();
    const commandId = randomUUID();
    await kit.service.execute(mine.userId, devGrant(mine.heroId, 0, 1, commandId));
    await expect(
      kit.service.execute(other.userId, devGrant(other.heroId, 0, 1, commandId)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('answers a stale revision with REVISION_CONFLICT and the current state', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, devGrant(heroId, 0, 5));
    const stale = await kit.service.execute(userId, devGrant(heroId, 0, 5));
    expect(stale).toMatchObject({ result: 'conflict', code: 'REVISION_CONFLICT' });
    expect(stale.aggregates.inventory!.revision).toBe(1);
    expect(coinsHeld(stale.aggregates.inventory!)).toBe(5);
  });

  it('lets exactly one of ten parallel commands on the same revision through', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => kit.service.execute(userId, devGrant(heroId, 0, 1))),
    );
    expect(results.filter((r) => r.result === 'applied')).toHaveLength(1);
    expect(results.filter((r) => r.result === 'conflict')).toHaveLength(9);
    expect(coinsHeld(await inventoryOf(heroId))).toBe(1);
  });

  it('never goes below zero when ten parallel spends hit a stack of five coins', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, devGrant(heroId, 0, 5));
    const results = await Promise.all(
      Array.from({ length: 10 }, () => kit.service.consumeItem(userId, heroId, COINS, 1)),
    );
    expect(results.filter((r) => r.result === 'applied')).toHaveLength(5);
    expect(results.filter((r) => r.code === 'NOT_ENOUGH')).toHaveLength(5);
    expect(coinsHeld(await inventoryOf(heroId))).toBe(0);

    const ledger = await kit.db
      .select()
      .from(itemLedger)
      .where(and(eq(itemLedger.heroId, heroId), eq(itemLedger.itemKey, COINS)))
      .orderBy(asc(itemLedger.id));
    expect(ledger.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
    expect(ledger.every((row) => row.balanceAfter >= 0)).toBe(true);
    expect(ledger.at(-1)?.balanceAfter).toBe(0);
  });

  it('keeps the ledger equal to the balance across grants, a split move and a chest purchase', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    await kit.service.execute(userId, devGrant(heroId, 1, 150));
    const inventory = await inventoryOf(heroId);
    const state = inventory.state as InventoryState;
    const index = state.bag.findIndex((cell) => cell?.key === COINS);
    const moved = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'MOVE_ITEM',
        {
          from: { container: 'bag', index },
          to: { container: 'equip', slot: 'weapon' },
          split: false,
        },
        inventory.revision,
      ),
    );
    expect(moved.result).toBe('applied');
    const unlocked = await kit.service.execute(
      userId,
      envelope(heroId, 'UNLOCK_STASH_CHEST', {}, moved.aggregates.inventory!.revision),
    );
    expect(unlocked.result).toBe('applied');

    const after = await inventoryOf(heroId);
    expect((after.state as InventoryState).stash.chests).toBe(2);
    expect(coinsHeld(after)).toBe(50);
    const ledger = await kit.db
      .select()
      .from(itemLedger)
      .where(and(eq(itemLedger.heroId, heroId), eq(itemLedger.itemKey, COINS)))
      .orderBy(asc(itemLedger.id));
    expect(ledger.map((row) => [row.delta, row.reason, row.balanceAfter])).toEqual([
      [150, 'dev', 150],
      [-100, 'stash_unlock', 50],
    ]);
  });

  it('replaces the whole inventory for a dev fixture and keeps the ledger equal to the balance', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, devGrant(heroId, 0, 4));
    const current = (await inventoryOf(heroId)).state as InventoryState;
    const layout: InventoryState = {
      ...current,
      bag: current.bag.map((cell) => (cell?.key === COINS ? { ...cell, amount: 10 } : cell)),
    };
    const result = await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_SET_INVENTORY', { inventory: layout }, 1),
    );
    expect(result.result).toBe('applied');
    expect(coinsHeld(await inventoryOf(heroId))).toBe(10);
    const ledger = await kit.db
      .select()
      .from(itemLedger)
      .where(and(eq(itemLedger.heroId, heroId), eq(itemLedger.itemKey, COINS)))
      .orderBy(asc(itemLedger.id));
    expect(ledger.map((row) => [row.delta, row.reason, row.balanceAfter])).toEqual([
      [4, 'dev', 4],
      [6, 'dev_set', 10],
    ]);
  });

  it('refuses buying the first chest before the camp chest is claimed', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const result = await kit.service.execute(userId, envelope(heroId, 'UNLOCK_STASH_CHEST', {}, 0));
    expect(result).toMatchObject({ result: 'rejected', code: 'CAMP_CHEST_NOT_CLAIMED' });
  });

  it('refuses a hero of another account and a payload that names another hero', async () => {
    const mine = await kit.newPlayer();
    const other = await kit.newPlayer();
    await expect(
      kit.service.execute(mine.userId, devGrant(other.heroId, 0, 1)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const sneaky = devGrant(mine.heroId, 0, 1);
    sneaky.command.payload.heroId = other.heroId;
    await expect(kit.service.execute(mine.userId, sneaky)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(coinsHeld(await inventoryOf(other.heroId))).toBe(0);
  });

  it.each([
    [
      'an unknown field in the payload',
      (e: ReturnType<typeof devGrant>) => {
        (e.command.payload as Record<string, unknown>).extra = 1;
        return e;
      },
      'INVALID_COMMAND',
    ],
    [
      'an unknown field in the envelope',
      (e: ReturnType<typeof devGrant>) => ({ ...e, extra: 1 }),
      'INVALID_ENVELOPE',
    ],
    [
      'a negative amount',
      (e: ReturnType<typeof devGrant>) => {
        (e.command.payload as Record<string, unknown>).amount = -5;
        return e;
      },
      'INVALID_COMMAND',
    ],
    [
      'a huge amount',
      (e: ReturnType<typeof devGrant>) => {
        (e.command.payload as Record<string, unknown>).amount = 10 ** 9;
        return e;
      },
      'INVALID_COMMAND',
    ],
    [
      'a key that is not in the content',
      (e: ReturnType<typeof devGrant>) => {
        (e.command.payload as Record<string, unknown>).key = 'laser-sword';
        return e;
      },
      'INVALID_COMMAND',
    ],
    [
      'a command the client may not send',
      (e: ReturnType<typeof devGrant>) => ({
        ...e,
        command: { type: 'GRANT_ITEM', payload: e.command.payload },
      }),
      'UNKNOWN_COMMAND',
    ],
    [
      'an oversized payload',
      (e: ReturnType<typeof devGrant>) => {
        (e.command.payload as Record<string, unknown>).junk = 'x'.repeat(9000);
        return e;
      },
      'PAYLOAD_TOO_LARGE',
    ],
    [
      'a bad commandId',
      (e: ReturnType<typeof devGrant>) => ({ ...e, commandId: 'nope' }),
      'INVALID_ENVELOPE',
    ],
    [
      'the wrong aggregate',
      (e: ReturnType<typeof devGrant>) => ({ ...e, aggregate: 'progress' }),
      'AGGREGATE_MISMATCH',
    ],
  ])('rejects %s before anything is written', async (_name, tamper, code) => {
    const { userId, heroId } = await kit.newPlayer();
    await expect(kit.service.execute(userId, tamper(devGrant(heroId, 0, 1)))).rejects.toMatchObject(
      { code },
    );
    expect(
      await kit.db.select().from(commandJournal).where(eq(commandJournal.heroId, heroId)),
    ).toHaveLength(0);
    expect(coinsHeld(await inventoryOf(heroId))).toBe(0);
  });

  it('refuses DEV_GRANT_ITEM in production for an ordinary hero, but not for a sandbox hero', async () => {
    const { userId, heroId } = await kit.newPlayer();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(await kit.service.execute(userId, devGrant(heroId, 0, 5))).toMatchObject({
        result: 'rejected',
        code: 'FORBIDDEN',
      });
      await kit.db.update(heroes).set({ isSandbox: true }).where(eq(heroes.id, heroId));
      expect((await kit.service.execute(userId, devGrant(heroId, 0, 5))).result).toBe('applied');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('writes nothing when the journal cannot be written', async () => {
    const failing = createTestKit((db) => {
      const transaction = db.transaction.bind(db);
      return new Proxy(db, {
        get(target, prop, receiver) {
          if (prop !== 'transaction') return Reflect.get(target, prop, receiver) as unknown;
          return ((callback: Parameters<Db['transaction']>[0], config?: never) =>
            transaction((tx) => {
              const guarded = new Proxy(tx, {
                get(txTarget, txProp, txReceiver) {
                  if (txProp !== 'insert')
                    return Reflect.get(txTarget, txProp, txReceiver) as unknown;
                  return (table: unknown) => {
                    if (table === commandJournal) throw new Error('journal is down');
                    return txTarget.insert(table as never);
                  };
                },
              });
              return callback(guarded);
            }, config)) as Db['transaction'];
        },
      });
    });
    try {
      const { userId, heroId } = await failing.newPlayer();
      await expect(failing.service.execute(userId, devGrant(heroId, 0, 5))).rejects.toThrow(
        'journal is down',
      );
      const snapshot = await failing.service.snapshot(userId, heroId);
      expect(snapshot.aggregates.inventory!.revision).toBe(0);
      expect(coinsHeld(snapshot.aggregates.inventory!)).toBe(0);
      expect(
        await failing.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId)),
      ).toHaveLength(0);
    } finally {
      await failing.close();
    }
  });

  it('resets a hero for dev: empty again, claimable again, ledger written off, revisions keep growing', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    await kit.service.execute(userId, devGrant(heroId, 1, 30));
    const snapshot = await kit.service.resetHero(userId, heroId);
    expect(snapshot.aggregates.inventory!.revision).toBe(3);
    expect(coinsHeld(snapshot.aggregates.inventory!)).toBe(0);
    expect((snapshot.aggregates.inventory!.state as InventoryState).stash.chests).toBe(0);
    expect(snapshot.aggregates.progress!.state).toMatchObject({
      claimedRewards: [],
      presence: null,
      steps: 0,
    });

    const again = await kit.service.execute(
      userId,
      envelope(heroId, 'CLAIM_CAMP_CHEST', {}, snapshot.aggregates.inventory!.revision),
    );
    expect(again.result).toBe('applied');

    const coins = await kit.db
      .select()
      .from(itemLedger)
      .where(and(eq(itemLedger.heroId, heroId), eq(itemLedger.itemKey, COINS)));
    expect(coins.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('refuses to reset an ordinary hero in production', async () => {
    const { userId, heroId } = await kit.newPlayer();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await expect(kit.service.resetHero(userId, heroId)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  const progressOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const knowledgeOf = (state: unknown) =>
    (state as { knowledge: { current: number; revision: number } }).knowledge;
  const arrive = (heroId: string, revision: number, locationKey: string, c: number, r: number) => {
    const e = envelope(
      heroId,
      'ARRIVE',
      { locationKey, mapId: `${locationKey}-1`, coordinates: { columnIndex: c, rowIndex: r } },
      revision,
      { aggregate: 'progress' },
    );
    delete (e.command.payload as { revision?: number }).revision;
    return e;
  };
  const stepTo = (
    heroId: string,
    revision: number,
    knowledgeRevision: number,
    c: number,
    r: number,
  ) => {
    const e = envelope(
      heroId,
      'KNOWLEDGE',
      { action: { kind: 'step', target: { columnIndex: c, rowIndex: r } } },
      revision,
      { aggregate: 'progress' },
    );
    e.command.payload.revision = knowledgeRevision;
    return e;
  };

  it("spends the hero's Will on the server, one step at a time, and keeps it after a reload", async () => {
    const { userId, heroId } = await kit.newPlayer();
    const arrived = await kit.service.execute(userId, arrive(heroId, 0, 'silesia', 5, 5));
    expect(arrived.result).toBe('applied');
    let revision = arrived.aggregates.progress!.revision;
    for (let i = 0; i < 3; i += 1) {
      const result = await kit.service.execute(userId, stepTo(heroId, revision, i, 5, 6 + i));
      expect(result.result).toBe('applied');
      revision = result.aggregates.progress!.revision;
    }
    const reloaded = await progressOf(userId, heroId);
    expect(knowledgeOf(reloaded.state).current).toBe(17);
    expect((reloaded.state as { steps: number }).steps).toBe(3);
  });

  it('refuses a step that is not next to the last place the server saw, and a step with no Will left', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const arrived = await kit.service.execute(userId, arrive(heroId, 0, 'silesia', 5, 5));
    const jump = await kit.service.execute(
      userId,
      stepTo(heroId, arrived.aggregates.progress!.revision, 0, 9, 9),
    );
    expect(jump).toMatchObject({ result: 'rejected', code: 'INVALID_STEP' });
    expect(knowledgeOf((await progressOf(userId, heroId)).state).current).toBe(20);
  });

  it('lets only one of ten parallel steps from the same place through, and never overspends', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const arrived = await kit.service.execute(userId, arrive(heroId, 0, 'silesia', 5, 5));
    const revision = arrived.aggregates.progress!.revision;
    const results = await Promise.all(
      Array.from({ length: 10 }, (_v, i) =>
        kit.service.execute(userId, stepTo(heroId, revision, 0, 5, 6 + (i % 2))),
      ),
    );
    expect(results.filter((r) => r.result === 'applied')).toHaveLength(1);
    expect(knowledgeOf((await progressOf(userId, heroId)).state).current).toBe(19);
  });

  it('upgrades a hero stored before Will lived on the server, keeping what he had claimed', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 1, state: { claimedRewards: ['camp-first-chest'] } })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    const progress = await progressOf(userId, heroId);
    expect(progress.state).toMatchObject({
      claimedRewards: ['camp-first-chest'],
      steps: 0,
      sealedUntil: {},
      portal: null,
    });
    expect(knowledgeOf(progress.state).current).toBe(20);
    const arrived = await kit.service.execute(
      userId,
      arrive(heroId, progress.revision, 'camping', 1, 1),
    );
    expect(arrived.result).toBe('applied');
    const [row] = await kit.db
      .select()
      .from(heroAggregates)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    expect(row.schemaVersion).toBe(3);
  });

  it('takes a snapshot every 50 revisions', async () => {
    const { userId, heroId } = await kit.newPlayer();
    for (let revision = 0; revision < 50; revision += 1) {
      await kit.service.execute(userId, devGrant(heroId, revision, 1));
    }
    const { aggregateSnapshots } = await import('../db/schema');
    const snaps = await kit.db
      .select()
      .from(aggregateSnapshots)
      .where(eq(aggregateSnapshots.heroId, heroId));
    expect(snaps.map((s) => [s.kind, s.revision, s.reason])).toEqual([
      ['inventory', 50, 'periodic'],
    ]);
  });

  it('rejects an error instance that is a PlayerCommandError with a code', async () => {
    const { userId } = await kit.newPlayer();
    const error = await kit.service.execute(userId, { nonsense: true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlayerCommandError);
  });
});
