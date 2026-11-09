import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { heroAggregates, heroes, users } from '../db/schema';
import { createTestKit, type TestKit } from '../player/player-test-kit';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('HeroesService (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  async function newUser(name = 'Oleh') {
    const [user] = await kit.db
      .insert(users)
      .values({ username: `h-${randomUUID()}`, password: 'x', name })
      .returning({ id: users.id });
    return user.id;
  }

  it('returns null when the account has no hero', async () => {
    expect(await kit.heroes.findByUserId(await newUser())).toBeNull();
  });

  it('creates a hero with 3 base hearts, named after the account, with no coins field', async () => {
    const userId = await newUser('Oleh');
    const hero = await kit.heroes.findOrCreateByUserId(userId);
    expect(hero).toMatchObject({ name: 'Oleh', currentHealth: 3, maxHealth: 3 });
    expect(hero).not.toHaveProperty('coins');
    const [row] = await kit.db.select().from(heroes).where(eq(heroes.id, hero.id));
    expect(row.data).not.toHaveProperty('coins');
    expect(row.isSandbox).toBe(false);
    expect(row.deletedAt).toBeNull();
  });

  it('creates the hero row and its aggregates together, and returns the same hero next time', async () => {
    const userId = await newUser();
    const first = await kit.heroes.findOrCreateByUserId(userId);
    const second = await kit.heroes.findOrCreateByUserId(userId);
    expect(second.id).toBe(first.id);
    const kinds = await kit.db
      .select({ kind: heroAggregates.kind })
      .from(heroAggregates)
      .where(eq(heroAggregates.heroId, first.id));
    expect(kinds.map((row) => row.kind).sort()).toEqual(['inventory', 'progress']);
  });

  it('heals a hero that predates the aggregates by creating them on the next fetch', async () => {
    const userId = await newUser();
    const hero = await kit.heroes.findOrCreateByUserId(userId);
    await kit.db.delete(heroAggregates).where(eq(heroAggregates.heroId, hero.id));
    await kit.heroes.findOrCreateByUserId(userId);
    const rows = await kit.db
      .select()
      .from(heroAggregates)
      .where(eq(heroAggregates.heroId, hero.id));
    expect(rows).toHaveLength(2);
  });

  it('merges the new location and steps into the stored data', async () => {
    const userId = await newUser();
    const hero = await kit.heroes.findOrCreateByUserId(userId);
    await kit.heroes.updateLocation(hero.id, { columnIndex: 9, rowIndex: 9 }, 99);
    expect(await kit.heroes.findByUserId(userId)).toMatchObject({
      heroLocation: { columnIndex: 9, rowIndex: 9 },
      heroSteps: 99,
      currentHealth: 3,
    });
  });

  it('does nothing when the hero to update does not exist', async () => {
    await expect(
      kit.heroes.updateLocation(randomUUID(), { columnIndex: 0, rowIndex: 0 }, 0),
    ).resolves.toBeUndefined();
  });
});
