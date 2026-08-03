import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/db.module';
import { HeroesService } from './heroes.service';

const HERO_DATA = {
  currentHealth: 8,
  maxHealth: 10,
  attack: 2,
  defense: 1,
  coins: 5,
  kills: 3,
  currentEnergy: 90,
  maxEnergy: 100,
  imgPath: '/hero.png',
  heroLocation: { columnIndex: 1, rowIndex: 2 },
  heroSteps: 42,
};

function createFakeDb(rows: Array<{ id: string; userId: string; name: string; data: unknown }>) {
  const updates: Array<{ id: string; data: unknown }> = [];

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
    update: () => ({
      set: (values: { data: unknown }) => ({
        where: () => {
          updates.push({ id: rows[0]?.id, data: values.data });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db: db as unknown as Db, updates };
}

describe('HeroesService', () => {
  it('returns null when no hero exists for the user', async () => {
    const { db } = createFakeDb([]);
    const service = new HeroesService(db);
    expect(await service.findByUserId(randomUUID())).toBeNull();
  });

  it('merges the hero row with its jsonb data', async () => {
    const heroId = randomUUID();
    const userId = randomUUID();
    const { db } = createFakeDb([{ id: heroId, userId, name: 'Merito', data: HERO_DATA }]);
    const service = new HeroesService(db);

    expect(await service.findByUserId(userId)).toEqual({
      id: heroId,
      name: 'Merito',
      ...HERO_DATA,
    });
  });

  describe('updateLocation', () => {
    it('merges the new location and steps into the existing jsonb data', async () => {
      const heroId = randomUUID();
      const userId = randomUUID();
      const { db, updates } = createFakeDb([
        { id: heroId, userId, name: 'Merito', data: HERO_DATA },
      ]);
      const service = new HeroesService(db);

      const newLocation = { columnIndex: 9, rowIndex: 9 };
      await service.updateLocation(heroId, newLocation, 99);

      expect(updates).toEqual([
        { id: heroId, data: { ...HERO_DATA, heroLocation: newLocation, heroSteps: 99 } },
      ]);
    });

    it('is a no-op when the hero does not exist', async () => {
      const { db, updates } = createFakeDb([]);
      const service = new HeroesService(db);

      await service.updateLocation(randomUUID(), { columnIndex: 0, rowIndex: 0 }, 0);

      expect(updates).toHaveLength(0);
    });
  });
});
