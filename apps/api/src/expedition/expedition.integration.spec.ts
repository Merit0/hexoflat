import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { corsOptions } from '../cors';
import { DB } from '../db/db.module';
import { expeditionBlobs, expeditionMembers, expeditions } from '../db/schema';
import { HERO_SESSIONS, type HeroSessions } from '../player/hero-sessions';
import { PlayerModule } from '../player/player.module';
import { createTestKit, type TestKit } from '../player/player-test-kit';
import {
  ExpeditionError,
  MAX_BLOB_BYTES,
  ensureExpedition,
  loadBlobs,
  patchBlobs,
} from './expedition-store';

const dbAvailable = inject('dbAvailable');
const MAP_A = `map:${randomUUID()}`;
const STATE_A = `state:${randomUUID()}`;

describe.skipIf(!dbAvailable)('expedition storage (real Postgres)', () => {
  let kit: TestKit;
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let sessions: HeroSessions;
  let url: string;

  beforeAll(async () => {
    kit = createTestKit();
    @Global()
    @Module({ providers: [{ provide: DB, useValue: kit.db }], exports: [DB] })
    class TestDbModule {}
    const moduleRef = await Test.createTestingModule({
      imports: [TestDbModule, JwtAuthModule, PlayerModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }),
    );
    app.enableCors({ ...corsOptions(), origin: 'http://localhost:5273' });
    await app.init();
    await app.listen(0);
    jwt = moduleRef.get(JwtService);
    sessions = moduleRef.get<HeroSessions>(HERO_SESSIONS);
    const address = app.getHttpServer().address();
    url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    await app.close();
    await kit.close();
  });

  it('gives a hero one active solo expedition, even from parallel first requests', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const ids = await Promise.all(
      Array.from({ length: 6 }, () => ensureExpedition(kit.db, userId, heroId)),
    );
    expect(new Set(ids).size).toBe(1);
    const members = await kit.db
      .select()
      .from(expeditionMembers)
      .where(eq(expeditionMembers.heroId, heroId));
    expect(members).toHaveLength(1);
    const [expedition] = await kit.db.select().from(expeditions).where(eq(expeditions.id, ids[0]));
    expect(expedition).toMatchObject({ kind: 'world', status: 'active', hostUserId: userId });
    expect(expedition.seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('stores, replaces and removes documents and counts the revision', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const id = await ensureExpedition(kit.db, userId, heroId);
    expect(await patchBlobs(kit.db, id, { [MAP_A]: '{"a":1}', nav: '{"k":1}' }, [])).toBe(1);
    expect(await patchBlobs(kit.db, id, { [MAP_A]: '{"a":2}' }, ['nav'])).toBe(2);
    expect(await loadBlobs(kit.db, id)).toEqual({ [MAP_A]: '{"a":2}' });
  });

  it.each([
    ['a key that is not part of the world', { 'evil/../key': '{}' }, 'BAD_KEY'],
    ['a map key that is not a map id', { 'map:123': '{}' }, 'BAD_KEY'],
    ['a document that is not JSON', { nav: 'not json' }, 'BAD_JSON'],
    ['a document that is too large', { nav: `"${'x'.repeat(MAX_BLOB_BYTES)}"` }, 'BLOB_TOO_LARGE'],
  ])('refuses %s and writes nothing', async (_name, put, code) => {
    const { userId, heroId } = await kit.newPlayer();
    const id = await ensureExpedition(kit.db, userId, heroId);
    await expect(patchBlobs(kit.db, id, put, [])).rejects.toMatchObject({ code });
    expect(await loadBlobs(kit.db, id)).toEqual({});
  });

  it('refuses too many documents in one expedition', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const id = await ensureExpedition(kit.db, userId, heroId);
    const put = Object.fromEntries(Array.from({ length: 65 }, () => [`map:${randomUUID()}`, '{}']));
    await expect(patchBlobs(kit.db, id, put, [])).rejects.toBeInstanceOf(ExpeditionError);
    expect(await loadBlobs(kit.db, id)).toEqual({});
  });

  describe('over HTTP', () => {
    async function call(userId: string, method: string, token: string | null, body?: unknown) {
      const bearer = await jwt.signAsync({ sub: userId, tokenVersion: 0 });
      return fetch(`${url}/expeditions/current`, {
        method,
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          ...(token ? { 'X-Player-Session': token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }

    it('answers the browser preflight for a save from the web origin, with the session header', async () => {
      const preflight = await fetch(`${url}/expeditions/current`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5273',
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'authorization,content-type,x-player-session',
        },
      });
      expect(preflight.status).toBeLessThan(300);
      expect(preflight.headers.get('access-control-allow-methods')).toMatch(/PATCH/);
      expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
        'x-player-session',
      );
    });

    it('needs a login', async () => {
      expect((await fetch(`${url}/expeditions/current`)).status).toBe(401);
    });

    it('saves for the tab that owns the hero and loads everything back', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const token = (sessions.claim(heroId, 'socket-1'), sessions.tokenOf(heroId)!);
      const saved = await call(userId, 'PATCH', token, {
        put: { [MAP_A]: '{"tiles":[]}', [STATE_A]: '{"contentVersion":1}' },
      });
      expect(saved.status).toBe(200);
      const loaded = (await (await call(userId, 'GET', null)).json()) as {
        blobs: Record<string, string>;
      };
      expect(loaded.blobs).toEqual({ [MAP_A]: '{"tiles":[]}', [STATE_A]: '{"contentVersion":1}' });
    });

    it('refuses a save without the session secret, and from a tab that was taken over', async () => {
      const { userId, heroId } = await kit.newPlayer();
      expect((await call(userId, 'PATCH', null, { put: { nav: '{}' } })).status).toBe(409);
      sessions.claim(heroId, 'old-tab');
      const oldToken = sessions.tokenOf(heroId)!;
      sessions.claim(heroId, 'new-tab');
      const taken = await call(userId, 'PATCH', oldToken, { put: { nav: '{}' } });
      expect(taken.status).toBe(409);
      expect(((await taken.json()) as { code: string }).code).toBe('SESSION_TAKEN_OVER');
      expect(
        (await call(userId, 'PATCH', sessions.tokenOf(heroId), { put: { nav: '{}' } })).status,
      ).toBe(200);
    });

    it('refuses a malformed body and an unknown key with a code', async () => {
      const { userId, heroId } = await kit.newPlayer();
      sessions.claim(heroId, 'tab');
      const token = sessions.tokenOf(heroId)!;
      expect((await call(userId, 'PATCH', token, { put: { nav: '{}' }, extra: 1 })).status).toBe(
        400,
      );
      const bad = await call(userId, 'PATCH', token, { put: { nope: '{}' } });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { code: string }).code).toBe('BAD_KEY');
    });

    it('never shows another account the expedition of this one', async () => {
      const mine = await kit.newPlayer();
      const other = await kit.newPlayer();
      sessions.claim(mine.heroId, 'tab');
      await call(mine.userId, 'PATCH', sessions.tokenOf(mine.heroId), {
        put: { nav: '{"secret":1}' },
      });
      const seen = (await (await call(other.userId, 'GET', null)).json()) as {
        blobs: Record<string, string>;
      };
      expect(seen.blobs).toEqual({});
    });
  });

  it('forgets the world when the hero is reset for dev', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const id = await ensureExpedition(kit.db, userId, heroId);
    await patchBlobs(kit.db, id, { nav: '{"x":1}' }, []);
    await kit.service.resetHero(userId, heroId);
    expect(await loadBlobs(kit.db, id)).toEqual({});
  });

  it('keeps the document row once per key', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const id = await ensureExpedition(kit.db, userId, heroId);
    await Promise.all([
      patchBlobs(kit.db, id, { nav: '{"a":1}' }, []),
      patchBlobs(kit.db, id, { nav: '{"a":2}' }, []),
    ]);
    const rows = await kit.db
      .select()
      .from(expeditionBlobs)
      .where(eq(expeditionBlobs.expeditionId, id));
    expect(rows).toHaveLength(1);
  });
});
