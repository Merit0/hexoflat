import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { heroes, users } from '../db/schema';
import { HeroDataError, type HeroDataPatch } from './heroes.dto';
import { createTestKit, type TestKit } from '../player/player-test-kit';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('D8, DA6: heroes.data read and write path (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await kit.close();
  });

  async function storedData(heroId: string): Promise<Record<string, unknown>> {
    const [row] = await kit.db.select().from(heroes).where(eq(heroes.id, heroId));
    return row.data as Record<string, unknown>;
  }

  async function heroWith(
    change: (data: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<{ userId: string; heroId: string }> {
    const [user] = await kit.db
      .insert(users)
      .values({ username: `d8-${randomUUID()}`, password: 'x', name: 'D8' })
      .returning({ id: users.id });
    const hero = await kit.heroes.findOrCreateByUserId(user.id);
    await kit.db
      .update(heroes)
      .set({ data: change(await storedData(hero.id)) })
      .where(eq(heroes.id, hero.id));
    return { userId: user.id, heroId: hero.id };
  }

  const withOrigin = (origin: string) => heroWith((data) => ({ ...data, origin }));
  const withoutOrigin = () =>
    heroWith((data) => {
      const rest = { ...data };
      delete rest.origin;
      return rest;
    });
  const withLegacyKey = () => heroWith((data) => ({ ...data, coins: 42 }));

  const refusalOf = async (heroId: string, patch: Record<string, unknown>): Promise<unknown> =>
    kit.heroes.updateData(heroId, patch as HeroDataPatch).catch((error: unknown) => error);

  it('D8: an existing field survives updateLocation, every other field keeps its value', async () => {
    const { userId, heroId } = await withOrigin('heaven');
    const before = await storedData(heroId);
    await kit.heroes.updateLocation(heroId, { columnIndex: 4, rowIndex: 5 }, 7);
    expect(await storedData(heroId)).toEqual({
      ...before,
      heroLocation: { columnIndex: 4, rowIndex: 5 },
      heroSteps: 7,
    });
    expect(await kit.heroes.findByUserId(userId)).toMatchObject({ origin: 'heaven', heroSteps: 7 });
  });

  it('D8: two parallel writes of different fields both survive', async () => {
    const { heroId } = await withOrigin('earth');
    await Promise.all([
      kit.heroes.updateLocation(heroId, { columnIndex: 2, rowIndex: 3 }, 9),
      kit.heroes.updateData(heroId, { kills: 5 }),
      kit.heroes.updateData(heroId, { attack: 8 }),
    ]);
    expect(await storedData(heroId)).toMatchObject({
      heroLocation: { columnIndex: 2, rowIndex: 3 },
      heroSteps: 9,
      kills: 5,
      attack: 8,
      origin: 'earth',
    });
  });

  it('DA6-4: an old row without origin loads as Nowhere and the next write stores it', async () => {
    const { userId, heroId } = await withoutOrigin();
    expect(await kit.heroes.findByUserId(userId)).toMatchObject({ origin: 'nowhere' });
    expect(await storedData(heroId)).not.toHaveProperty('origin');
    await kit.heroes.updateLocation(heroId, { columnIndex: 1, rowIndex: 1 }, 1);
    expect(await storedData(heroId)).toMatchObject({ origin: 'nowhere', heroSteps: 1 });
  });

  it('DA6-4: an old row cannot get another origin than Nowhere by its first write', async () => {
    const { heroId } = await withoutOrigin();
    const before = await storedData(heroId);
    expect(await refusalOf(heroId, { origin: 'heaven' })).toMatchObject({
      code: 'HERO_ORIGIN_IMMUTABLE',
    });
    expect(await storedData(heroId)).toEqual(before);
  });

  it('DA6-5: an unknown key on write is refused by name and the row does not change', async () => {
    const { heroId } = await withOrigin('nowhere');
    const before = await storedData(heroId);
    const error = await refusalOf(heroId, { heroSteps: 3, coins: 1 });
    expect(error).toBeInstanceOf(HeroDataError);
    expect(error).toMatchObject({ code: 'HERO_DATA_UNKNOWN_FIELD', detail: 'coins' });
    expect(await storedData(heroId)).toEqual(before);
  });

  it('DA6-5: a legacy unknown key is stripped on read with one dev log, and the hero loads', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { userId, heroId } = await withLegacyKey();
    const hero = await kit.heroes.findByUserId(userId);
    expect(hero).toMatchObject({ id: heroId, currentHealth: 3, origin: 'nowhere' });
    expect(hero).not.toHaveProperty('coins');
    await kit.heroes.findOrCreateByUserId(userId);
    const mine = warn.mock.calls.filter(([message]) => String(message).includes(heroId));
    expect(mine).toEqual([[`Hero ${heroId} stores unknown fields, ignored: coins`]]);
  });

  it('DA6-5: the dev log is silent in production', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    const { userId } = await withLegacyKey();
    await kit.heroes.findByUserId(userId);
    expect(warn).not.toHaveBeenCalled();
  });

  it('DA6-5: a write keeps a legacy unknown key in the row and does not break on it', async () => {
    const { heroId } = await withLegacyKey();
    await kit.heroes.updateLocation(heroId, { columnIndex: 6, rowIndex: 6 }, 2);
    expect(await storedData(heroId)).toMatchObject({ coins: 42, heroSteps: 2, origin: 'nowhere' });
  });

  it.each([
    ['a wrong type', { heroSteps: 'many' }],
    ['an explicitly missing value', { heroSteps: undefined }],
    ['an unknown dimension', { origin: 'mars' }],
  ])('DA6: %s on write is refused and the row does not change', async (_name, patch) => {
    const { heroId } = await withOrigin('nowhere');
    const before = await storedData(heroId);
    expect(await refusalOf(heroId, patch)).toMatchObject({ code: 'HERO_DATA_INVALID' });
    expect(await storedData(heroId)).toEqual(before);
  });

  it('C8: a stored unknown dimension is rejected, never read as Nowhere', async () => {
    const { userId, heroId } = await withOrigin('mars');
    await expect(kit.heroes.findByUserId(userId)).rejects.toMatchObject({
      code: 'HERO_DATA_INVALID',
    });
    await expect(
      kit.heroes.updateLocation(heroId, { columnIndex: 0, rowIndex: 0 }, 0),
    ).rejects.toMatchObject({ code: 'HERO_DATA_INVALID' });
  });
});
