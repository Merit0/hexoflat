import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { PLAYER_COMMAND_SCHEMAS } from '@hexoflat/engine';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import { RegisterDtoSchema } from '../auth/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { heroes } from '../db/schema';
import { ensureExpedition, patchBlobs } from '../expedition/expedition-store';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { WorldService } from '../world/world.service';
import { HeroesController } from './heroes.controller';
import type { HeroDataPatch } from './heroes.dto';

const HERO_KEYS = [
  'attack',
  'currentEnergy',
  'currentHealth',
  'defense',
  'heroLocation',
  'heroSteps',
  'id',
  'imgPath',
  'kills',
  'maxEnergy',
  'maxHealth',
  'name',
];

describe.skipIf(!inject('dbAvailable'))('DA6: hero origin (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  async function row(heroId: string) {
    const [record] = await kit.db.select().from(heroes).where(eq(heroes.id, heroId));
    return record;
  }
  const originOf = async (heroId: string) =>
    ((await row(heroId)).data as { origin: string }).origin;

  async function setStoredOrigin(heroId: string, origin: EDimension) {
    const { data } = await row(heroId);
    await kit.db
      .update(heroes)
      .set({ data: { ...(data as object), origin } })
      .where(eq(heroes.id, heroId));
  }

  async function playAndReload(player: { userId: string; heroId: string }) {
    await kit.heroes.updateLocation(player.heroId, { columnIndex: 3, rowIndex: 4 }, 12);
    const claimed = await kit.service.execute(
      player.userId,
      envelope(player.heroId, 'CLAIM_CAMP_CHEST', {}, 0),
    );
    expect(claimed.result).toBe('applied');
    await new WorldService(kit.db, kit.heroes).ensure(player.userId, player.heroId, 'camping');
    const reloaded = createTestKit();
    try {
      return await reloaded.heroes.findOrCreateByUserId(player.userId);
    } finally {
      await reloaded.close();
    }
  }

  it('DA6-2: a new hero is stored with origin Nowhere and keeps it through move, save and reload', async () => {
    const player = await kit.newPlayer();
    expect(await originOf(player.heroId)).toBe('nowhere');
    expect(await playAndReload(player)).toMatchObject({ origin: 'nowhere', heroSteps: 12 });
    expect(await originOf(player.heroId)).toBe('nowhere');
  });

  it.each(Object.values(EDimension))(
    'DA6-2: a hero born in %s keeps that origin, so a default never replaces it',
    async (origin) => {
      const player = await kit.newPlayer();
      await setStoredOrigin(player.heroId, origin);
      expect(await playAndReload(player)).toMatchObject({ origin, heroSteps: 12 });
      expect(await originOf(player.heroId)).toBe(origin);
    },
  );

  it.each(Object.values(EDimension))(
    'DA6-3: a write that changes origin %s is refused, the row is unchanged',
    async (origin) => {
      const player = await kit.newPlayer();
      await setStoredOrigin(player.heroId, origin);
      const before = await row(player.heroId);
      for (const next of Object.values(EDimension).filter((other) => other !== origin)) {
        const patch = { heroSteps: 99, origin: next } as HeroDataPatch;
        await expect(kit.heroes.updateData(player.heroId, patch)).rejects.toMatchObject({
          code: 'HERO_ORIGIN_IMMUTABLE',
        });
      }
      expect(await row(player.heroId)).toEqual(before);
    },
  );

  it('DA6-3: a registration request with an origin is refused by name', () => {
    const pipe = new ZodValidationPipe(RegisterDtoSchema);
    const body = { username: `o-${randomUUID()}`, password: 'long-enough', name: 'Hero' };
    expect(pipe.transform(body)).toEqual(body);
    let error: unknown;
    try {
      pipe.transform({ ...body, origin: 'heaven' });
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).toContain(
      'HERO_ORIGIN_SERVER_ONLY',
    );
  });

  it.each(Object.keys(PLAYER_COMMAND_SCHEMAS))(
    'DA6-3: the player command %s refuses an origin in its payload, the row is unchanged',
    async (type) => {
      const { userId, heroId } = await kit.newPlayer();
      const before = await row(heroId);
      const sent = envelope(heroId, type, { origin: 'heaven' }, 0);
      const schema = PLAYER_COMMAND_SCHEMAS[type as keyof typeof PLAYER_COMMAND_SCHEMAS];
      expect(schema.safeParse(sent.command).error?.issues).toContainEqual(
        expect.objectContaining({
          code: 'unrecognized_keys',
          keys: expect.arrayContaining(['origin']) as unknown,
        }),
      );
      await expect(kit.service.execute(userId, sent)).rejects.toMatchObject({
        code: 'INVALID_COMMAND',
      });
      await expect(
        kit.service.execute(userId, { ...envelope(heroId, type, {}, 0), origin: 'heaven' }),
      ).rejects.toMatchObject({ code: 'INVALID_ENVELOPE' });
      expect(await row(heroId)).toEqual(before);
    },
  );

  it('DA6-3: the hero blob of the client cannot change the origin', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    await patchBlobs(
      kit.db,
      expeditionId,
      { 'hero-store': JSON.stringify({ hero: { origin: 'heaven' } }) },
      [],
    );
    expect(await kit.heroes.findOrCreateByUserId(userId)).toMatchObject({ origin: 'nowhere' });
    expect(await originOf(heroId)).toBe('nowhere');
  });

  it('DA6-6: GET /heroes/me adds only origin to the hero; the aggregates do not carry it', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const hero = await new HeroesController(kit.heroes).getMine({
      user: { sub: userId },
    } as never);
    expect(Object.keys(hero).sort()).toEqual([...HERO_KEYS, 'origin'].sort());
    expect(hero.origin).toBe('nowhere');
    const { aggregates } = await kit.service.snapshot(userId, heroId);
    for (const aggregate of Object.values(aggregates)) {
      expect(aggregate.state).not.toHaveProperty('origin');
    }
  });
});
