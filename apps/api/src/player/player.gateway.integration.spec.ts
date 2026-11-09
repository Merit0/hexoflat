import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { DB } from '../db/db.module';
import { PlayerModule } from './player.module';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');

function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

interface Snapshot {
  heroId: string;
  aggregates: Record<string, { revision: number; state: unknown }>;
}
interface Result {
  commandId: string;
  result: string;
  code?: string;
  aggregates: Record<string, { revision: number }>;
}

describe.skipIf(!dbAvailable)('PlayerGateway (socket.io + real Postgres)', () => {
  let kit: TestKit;
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let url: string;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    kit = createTestKit();
    @Global()
    @Module({ providers: [{ provide: DB, useValue: kit.db }], exports: [DB] })
    class TestDbModule {}
    const moduleRef = await Test.createTestingModule({
      imports: [TestDbModule, JwtAuthModule, PlayerModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    jwt = moduleRef.get(JwtService);
    const address = app.getHttpServer().address();
    url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    await app.close();
    await kit.close();
  });

  async function connect(userId: string, withToken = true): Promise<ClientSocket> {
    const token = await jwt.signAsync({ sub: userId, tokenVersion: 0 });
    const client = io(`${url}/player`, {
      transports: ['websocket'],
      forceNew: true,
      ...(withToken ? { auth: { token } } : {}),
    });
    clients.push(client);
    return client;
  }

  it('refuses a connection without a token', async () => {
    const client = await connect(randomUUID(), false);
    const error = await waitFor<Error>(client, 'connect_error');
    expect(error.message).toMatch(/token/i);
  });

  it('subscribes to the current hero, runs a command and answers with the new revision', async () => {
    const { userId } = await kit.newPlayer();
    const client = await connect(userId);
    await waitFor(client, 'connect');
    const snapshot = waitFor<Snapshot>(client, 'hero:snapshot');
    client.emit('hero:subscribe', {});
    const first = await snapshot;
    expect(Object.keys(first.aggregates).sort()).toEqual(['inventory', 'progress']);

    const result = waitFor<Result>(client, 'hero:result');
    client.emit('hero:command', envelope(first.heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    const answer = await result;
    expect(answer.result).toBe('applied');
    expect(answer.aggregates.inventory.revision).toBe(1);
  });

  it('takes the hero over: the old connection is told and closed, its commands are refused', async () => {
    const { userId } = await kit.newPlayer();
    const first = await connect(userId);
    await waitFor(first, 'connect');
    const firstSnapshot = waitFor<Snapshot>(first, 'hero:snapshot');
    first.emit('hero:subscribe', {});
    const { heroId } = await firstSnapshot;

    const told = waitFor<{ code: string }>(first, 'hero:error');
    const closed = waitFor(first, 'disconnect');
    const second = await connect(userId);
    await waitFor(second, 'connect');
    const secondSnapshot = waitFor<Snapshot>(second, 'hero:snapshot');
    second.emit('hero:subscribe', { heroId });
    await secondSnapshot;

    expect(await told).toEqual({ code: 'SESSION_TAKEN_OVER' });
    await closed;

    const result = waitFor<Result>(second, 'hero:result');
    second.emit(
      'hero:command',
      envelope(heroId, 'DEV_GRANT_ITEM', { key: HEXOBJECT_KEYS.COINS, amount: 3 }, 0),
    );
    expect((await result).result).toBe('applied');
  });

  it('refuses a command before subscribing, for another hero, and past the rate limit', async () => {
    const mine = await kit.newPlayer();
    const other = await kit.newPlayer();
    const client = await connect(mine.userId);
    await waitFor(client, 'connect');

    const early = waitFor<{ code: string }>(client, 'hero:error');
    client.emit('hero:command', envelope(mine.heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    expect((await early).code).toBe('SESSION_TAKEN_OVER');

    const snapshot = waitFor<Snapshot>(client, 'hero:snapshot');
    client.emit('hero:subscribe', {});
    await snapshot;

    const foreign = waitFor<{ code: string }>(client, 'hero:error');
    client.emit('hero:command', envelope(other.heroId, 'CLAIM_CAMP_CHEST', {}, 0));
    expect((await foreign).code).toBe('FORBIDDEN');

    const codes: string[] = [];
    client.on('hero:error', (payload: { code: string }) => codes.push(payload.code));
    for (let i = 0; i < 40; i += 1) {
      client.emit('hero:command', envelope(mine.heroId, 'SORT_STASH', {}, 0));
    }
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (codes.includes('RATE_LIMITED')) {
          clearInterval(timer);
          resolve();
        }
      }, 20);
    });
    expect(codes).toContain('RATE_LIMITED');
  });

  it('enters a world and takes a step over the socket, and the server map is the one the REST snapshot returns', async () => {
    const { userId } = await kit.newPlayer();
    const client = await connect(userId);
    await waitFor(client, 'connect');
    const snapshot = waitFor<Snapshot>(client, 'hero:snapshot');
    client.emit('hero:subscribe', {});
    const { heroId, aggregates } = await snapshot;

    const entered = waitFor<{ result: string; hero: { coordinates: unknown } }>(
      client,
      'world:result',
    );
    client.emit('world:command', {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: aggregates.progress.revision,
      command: { type: 'WORLD_ENTER', payload: { heroId, locationKey: 'camping' } },
    });
    const answer = await entered;
    expect(answer.result).toBe('applied');
    expect(answer.hero.coordinates).not.toBeNull();

    const bearer = await jwt.signAsync({ sub: userId, tokenVersion: 0 });
    const rest = await fetch(`${url}/player/world`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(rest.status).toBe(200);
    const map = (await rest.json()) as { locationKey: string; heroCoordinates: unknown };
    expect(map.locationKey).toBe('camping');
    expect(map.heroCoordinates).toEqual(answer.hero.coordinates);
  });

  it('refuses a world command before subscribing', async () => {
    const mine = await kit.newPlayer();
    const client = await connect(mine.userId);
    await waitFor(client, 'connect');
    const error = waitFor<{ code: string }>(client, 'hero:error');
    client.emit('world:command', {
      commandId: randomUUID(),
      heroId: mine.heroId,
      aggregate: 'progress',
      expectedRevision: 0,
      command: { type: 'WORLD_ENTER', payload: { heroId: mine.heroId, locationKey: 'camping' } },
    });
    expect((await error).code).toBe('SESSION_TAKEN_OVER');
  });

  it('refuses to subscribe to a hero of another account', async () => {
    const mine = await kit.newPlayer();
    const other = await kit.newPlayer();
    const client = await connect(mine.userId);
    await waitFor(client, 'connect');
    const error = waitFor<{ code: string }>(client, 'hero:error');
    client.emit('hero:subscribe', { heroId: other.heroId });
    expect((await error).code).toBe('FORBIDDEN');
  });
});
