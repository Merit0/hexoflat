import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { aggregateSnapshots, users } from '../db/schema';
import { AdminToolError, heroHistory, rollbackAggregate, seedHero } from './admin-tools';
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
    expect(kept.map((row) => [row.revision, row.reason]).sort()).toEqual([
      [50, 'periodic'],
      [53, 'rollback'],
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
});
