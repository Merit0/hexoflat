import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { AGGREGATES, AGGREGATE_KINDS, type ProgressState } from '@hexoflat/engine';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { aggregateSnapshots, heroAggregates, users } from '../db/schema';
import {
  AdminToolError,
  UNVERSIONED_SNAPSHOT_SCHEMA,
  heroHistory,
  rollbackAggregate,
  seedHero,
} from './admin-tools';
import { loadAggregates } from './aggregate-store';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('admin tools (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  const coinsOf = async (userId: string, heroId: string) => {
    const snapshot = await kit.service.snapshot(userId, heroId);
    const state = snapshot.aggregates.inventory!.state as InventoryState;
    return [...state.bag, ...Object.values(state.equip), ...state.stash.cells]
      .filter((cell) => cell?.key === HEXOBJECT_KEYS.COINS)
      .reduce((sum, cell) => sum + (cell?.amount ?? 0), 0);
  };

  it('seeds a test hero with a kit through the ledgered server path', async () => {
    const login = `seed-${randomUUID()}`;
    const [user] = await kit.db
      .insert(users)
      .values({ username: login, password: 'x', name: 'Seeded' })
      .returning({ id: users.id });
    const result = await seedHero(kit.db, kit.heroes, kit.service, login, 'full');
    expect(result.granted).toHaveLength(5);
    expect(await coinsOf(user.id, result.heroId)).toBe(1000);
    const { ledger } = await heroHistory(kit.db, result.heroId);
    expect(ledger.every((row) => row.reason === 'dev')).toBe(true);
    expect(ledger).toHaveLength(5);
  });

  it('refuses an unknown login and refuses to run in production', async () => {
    await expect(seedHero(kit.db, kit.heroes, kit.service, 'nobody-here')).rejects.toBeInstanceOf(
      AdminToolError,
    );
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await expect(seedHero(kit.db, kit.heroes, kit.service, 'x')).rejects.toThrow(/production/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('shows the journal and the ledger of a hero in order', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    await kit.service.execute(userId, envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 1));
    const { journal, ledger } = await heroHistory(kit.db, heroId);
    expect(journal.map((row) => row.result)).toEqual(['applied', 'rejected']);
    expect(ledger).toHaveLength(4);
  });

  it('rolls an aggregate back to a snapshot as a new revision, and only with confirmation', async () => {
    const { userId, heroId } = await kit.newPlayer();
    for (let revision = 0; revision < 53; revision += 1) {
      await kit.service.execute(
        userId,
        envelope(heroId, 'DEV_GRANT_ITEM', { key: HEXOBJECT_KEYS.COINS, amount: 1 }, revision),
      );
    }
    expect(await coinsOf(userId, heroId)).toBe(53);

    const dry = await rollbackAggregate(kit.db, heroId, 'inventory', 50, { confirm: false });
    expect(dry).toEqual({ kind: 'inventory', fromRevision: 53, toRevision: 50, newRevision: 54 });
    expect(await coinsOf(userId, heroId)).toBe(53);

    await rollbackAggregate(kit.db, heroId, 'inventory', 50, { confirm: true });
    expect(await coinsOf(userId, heroId)).toBe(50);
    const after = await kit.service.snapshot(userId, heroId);
    expect(after.aggregates.inventory!.revision).toBe(54);

    const kept = await kit.db
      .select()
      .from(aggregateSnapshots)
      .where(eq(aggregateSnapshots.heroId, heroId));
    const current = AGGREGATES.inventory.schemaVersion;
    expect(kept.map((row) => [row.revision, row.reason, row.schemaVersion]).sort()).toEqual([
      [50, 'periodic', current],
      [53, 'rollback', current],
    ]);

    const next = await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_GRANT_ITEM', { key: HEXOBJECT_KEYS.COINS, amount: 1 }, 54),
    );
    expect(next.result).toBe('applied');
  });

  it('refuses a rollback to a revision that has no snapshot', async () => {
    const { heroId } = await kit.newPlayer();
    await expect(
      rollbackAggregate(kit.db, heroId, 'inventory', 7, { confirm: true }),
    ).rejects.toThrow(/No snapshot/);
  });

  const storedProgress = async (heroId: string) => {
    const [row] = await kit.db
      .select()
      .from(heroAggregates)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    return row;
  };

  const progressV11 = (state: unknown, steps: number) => {
    const current = structuredClone(state) as Record<string, unknown>;
    delete current.uniqueBuyback;
    return { ...current, steps, ownedUniques: ['lantern-eater'] };
  };

  const addSnapshot = async (
    heroId: string,
    state: unknown,
    revision: number,
    schemaVersion: number | null,
  ) =>
    kit.db
      .insert(aggregateSnapshots)
      .values({ heroId, kind: 'progress', revision, schemaVersion, state, reason: 'periodic' });

  it('DA6-1: rolls back to a snapshot taken before a schema bump and stores the upcast state', async () => {
    const { heroId } = await kit.newPlayer();
    const before = await storedProgress(heroId);
    await addSnapshot(heroId, progressV11(before.state, 41), 1000, 11);

    await rollbackAggregate(kit.db, heroId, 'progress', 1000, { confirm: true });

    const row = await storedProgress(heroId);
    expect(row.schemaVersion).toBe(AGGREGATES.progress.schemaVersion);
    expect(row.state).toEqual({ ...(before.state as ProgressState), steps: 41 });
    expect((await loadAggregates(kit.db, heroId)).progress!.state.steps).toBe(41);
  });

  it('DA6-1: the state replaced by a rollback keeps its own version and can be restored', async () => {
    const { heroId } = await kit.newPlayer();
    const before = await storedProgress(heroId);
    await kit.db
      .update(heroAggregates)
      .set({ state: progressV11(before.state, 7), schemaVersion: 11 })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    await addSnapshot(heroId, before.state, 1000, AGGREGATES.progress.schemaVersion);
    await rollbackAggregate(kit.db, heroId, 'progress', 1000, { confirm: true });

    const [kept] = await kit.db
      .select()
      .from(aggregateSnapshots)
      .where(and(eq(aggregateSnapshots.heroId, heroId), eq(aggregateSnapshots.reason, 'rollback')));
    expect(kept.schemaVersion).toBe(11);

    await rollbackAggregate(kit.db, heroId, 'progress', kept.revision, { confirm: true });
    expect((await storedProgress(heroId)).state).toEqual({
      ...(before.state as ProgressState),
      steps: 7,
    });
  });

  it('DA6-1: a snapshot without a version is read as the last version before DA6', async () => {
    expect(UNVERSIONED_SNAPSHOT_SCHEMA).toEqual({ inventory: 6, progress: 14 });
    expect(Object.keys(UNVERSIONED_SNAPSHOT_SCHEMA).sort()).toEqual([...AGGREGATE_KINDS].sort());
    const { heroId } = await kit.newPlayer();
    const before = await storedProgress(heroId);
    await addSnapshot(heroId, { ...(before.state as ProgressState), steps: 5 }, 1000, null);
    await rollbackAggregate(kit.db, heroId, 'progress', 1000, { confirm: true });
    expect((await storedProgress(heroId)).state).toMatchObject({ steps: 5 });
  });

  it('DA6-1: an unversioned snapshot of an older shape is refused by name and changes nothing', async () => {
    const { heroId } = await kit.newPlayer();
    const before = await storedProgress(heroId);
    await addSnapshot(heroId, progressV11(before.state, 41), 1000, null);
    const error = await rollbackAggregate(kit.db, heroId, 'progress', 1000, {
      confirm: true,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdminToolError);
    expect((error as Error).message).toContain('cannot be read as schema v14');
    expect(await storedProgress(heroId)).toEqual(before);
  });
});
