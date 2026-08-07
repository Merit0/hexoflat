import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/db.module';
import { heroes, users } from '../db/schema';
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

interface FakeHeroRow {
  id: string;
  userId: string;
  name: string;
  data: unknown;
}

function createFakeDb(heroRows: FakeHeroRow[], userRows: Array<{ id: string; name: string }> = []) {
  const updates: Array<{ id: string; data: unknown }> = [];
  const inserted: Array<{ userId: string; name: string; data: unknown }> = [];

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => Promise.resolve(table === users ? userRows : heroRows),
        }),
      }),
    }),
    update: () => ({
      set: (values: { data: unknown }) => ({
        where: () => {
          updates.push({ id: heroRows[0]?.id, data: values.data });
          return Promise.resolve();
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: { userId: string; name: string; data: unknown }) => {
        if (table !== heroes) throw new Error('unexpected insert target in fake db');
        inserted.push(row);
        return {
          returning: () =>
            Promise.resolve([{ id: randomUUID(), userId: row.userId, name: row.name }]),
        };
      },
    }),
  };

  return { db: db as unknown as Db, updates, inserted };
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

  describe('findOrCreateByUserId', () => {
    it('returns the existing hero without inserting when one is already there', async () => {
      const heroId = randomUUID();
      const userId = randomUUID();
      const { db, inserted } = createFakeDb([
        { id: heroId, userId, name: 'Merito', data: HERO_DATA },
      ]);
      const service = new HeroesService(db);

      const hero = await service.findOrCreateByUserId(userId);

      expect(hero).toEqual({ id: heroId, name: 'Merito', ...HERO_DATA });
      expect(inserted).toHaveLength(0);
    });

    it('creates a hero with 10 base HP when none exists yet, named after the account', async () => {
      const userId = randomUUID();
      const { db, inserted } = createFakeDb([], [{ id: userId, name: 'Oleh' }]);
      const service = new HeroesService(db);

      const hero = await service.findOrCreateByUserId(userId);

      expect(hero).toMatchObject({ name: 'Oleh', currentHealth: 10, maxHealth: 10 });
      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({ userId, name: 'Oleh' });
      expect(inserted[0].data).toMatchObject({ currentHealth: 10, maxHealth: 10 });
    });

    it('falls back to a generic name when the user record is missing', async () => {
      const userId = randomUUID();
      const { db } = createFakeDb([], []);
      const service = new HeroesService(db);

      const hero = await service.findOrCreateByUserId(userId);

      expect(hero.name).toBe('Hero');
    });
  });
});
