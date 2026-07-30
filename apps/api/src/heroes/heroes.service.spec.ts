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

function createFakeDb(
  rows: Array<{ id: string; userId: string; name: string; data: unknown }>,
): Db {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
  } as unknown as Db;
}

describe('HeroesService', () => {
  it('returns null when no hero exists for the user', async () => {
    const service = new HeroesService(createFakeDb([]));
    expect(await service.findByUserId(randomUUID())).toBeNull();
  });

  it('merges the hero row with its jsonb data', async () => {
    const heroId = randomUUID();
    const userId = randomUUID();
    const service = new HeroesService(
      createFakeDb([{ id: heroId, userId, name: 'Merito', data: HERO_DATA }]),
    );

    expect(await service.findByUserId(userId)).toEqual({
      id: heroId,
      name: 'Merito',
      ...HERO_DATA,
    });
  });
});
