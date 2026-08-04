import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { serializeState, type HexEngineState, type SnapshotPayload } from '@hexoflat/engine';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { scenarios } from '../db/schema';
import { DB, type Db } from '../db/db.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { HeroesService } from '../heroes/heroes.service';
import { GameModule } from './game.module';

interface FakeSnapshotRow {
  state: unknown;
  checksum: string;
  createdAt: string;
}

function createFakeDb(seedRows: FakeSnapshotRow[], scenarioOwnerId: string) {
  const rows = [...seedRows];
  const inserted: Array<{
    scenariosId: string;
    saveId: string | null;
    state: unknown;
    checksum: string;
  }> = [];

  const db = {
    select: () => ({
      from: (table: unknown) => {
        if (table === scenarios) {
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ ownerId: scenarioOwnerId }]),
              }),
            }),
          };
        }
        return {
          where: () => ({
            orderBy: () => ({
              limit: (n: number) => Promise.resolve(rows.slice(0, n)),
            }),
          }),
        };
      },
    }),
    insert: () => ({
      values: (row: {
        scenariosId: string;
        saveId: string | null;
        state: unknown;
        checksum: string;
      }) => {
        inserted.push(row);
        rows.unshift({
          state: row.state,
          checksum: row.checksum,
          createdAt: new Date().toISOString(),
        });
        return Promise.resolve();
      },
    }),
    transaction: (fn: (tx: Db) => Promise<void>) => fn(db as unknown as Db),
  };

  return { db: db as unknown as Db, inserted };
}

function createTestDbModule(db: Db) {
  @Global()
  @Module({ providers: [{ provide: DB, useValue: db }], exports: [DB] })
  class TestDbModule {}
  return TestDbModule;
}

function buildFullyRevealedMap(): HexEngineState['map'] {
  const map = new HexMapBuilder().name('gateway-test-map').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

function buildHero(overrides: Partial<IHero>): IHero {
  return {
    id: 'hero',
    name: 'Hero',
    currentHealth: 10,
    maxHealth: 10,
    attack: 1,
    defense: 1,
    coins: 0,
    kills: 0,
    currentEnergy: 100,
    maxEnergy: 100,
    imgPath: '',
    heroLocation: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 0,
    ...overrides,
  };
}

const HERO_A = buildHero({ id: 'hero-a', heroLocation: { columnIndex: 0, rowIndex: 0 } });
const HERO_B = buildHero({ id: 'hero-b', heroLocation: { columnIndex: 2, rowIndex: 2 } });

describe('GameGateway (socket.io integration)', () => {
  let app: NestFastifyApplication;
  let url: string;
  let jwtService: JwtService;
  let inserted: Array<{ scenariosId: string; saveId: string | null; state: unknown }>;
  // Owned by user-a's campaign — used to prove both that the owner can join
  // and that a non-owner (user-b) is rejected from the same scenario.
  const scenarioId = randomUUID();

  beforeAll(async () => {
    const seedState: HexEngineState = { map: buildFullyRevealedMap(), heroes: {} };
    const seedPayload = serializeState(seedState);
    const fakeDb = createFakeDb(
      [{ state: seedPayload, checksum: seedPayload.checksum, createdAt: new Date().toISOString() }],
      'user-a',
    );
    inserted = fakeDb.inserted;

    const fakeHeroesService = {
      findByUserId: vi.fn((userId: string) => {
        if (userId === 'user-a') return Promise.resolve(HERO_A);
        if (userId === 'user-b') return Promise.resolve(HERO_B);
        return Promise.resolve(null);
      }),
      updateLocation: vi.fn(() => Promise.resolve()),
    } as unknown as HeroesService;

    const moduleRef = await Test.createTestingModule({
      imports: [createTestDbModule(fakeDb.db), JwtAuthModule, GameModule],
    })
      .overrideProvider(HeroesService)
      .useValue(fakeHeroesService)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    jwtService = moduleRef.get(JwtService);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a connection with no auth token', async () => {
    const client: ClientSocket = io(url, { transports: ['websocket'], forceNew: true });
    const connectError = await waitFor<Error>(client, 'connect_error');
    expect(connectError.message).toMatch(/token/i);
    client.close();
  });

  it('rejects join-scenario from a user who does not own the scenario campaign', async () => {
    const tokenB = await jwtService.signAsync({ sub: 'user-b' });
    const clientB: ClientSocket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenB },
    });
    await waitFor(clientB, 'connect');

    const error = waitFor<{ message: string }>(clientB, 'error');
    clientB.emit('join-scenario', { scenarioId });
    const errorPayload = await error;

    expect(errorPayload.message).toMatch(/not authorized/i);
    clientB.disconnect();
  });

  it('syncs the owner joining, broadcasts moves, enforces hero ownership, and resumes state on reconnect', async () => {
    const tokenA = await jwtService.signAsync({ sub: 'user-a' });
    const clientA: ClientSocket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenA },
    });

    await waitFor(clientA, 'connect');

    clientA.emit('join-scenario', { scenarioId });
    const syncA = await waitFor<SnapshotPayload>(clientA, 'state-sync');
    expect(syncA.heroes[HERO_A.id]).toMatchObject({ coordinates: HERO_A.heroLocation });

    const updateA = waitFor<{ events: unknown; state: SnapshotPayload }>(clientA, 'state-update');
    clientA.emit('command', {
      scenarioId,
      command: {
        type: 'MOVE_HERO',
        payload: { heroId: HERO_A.id, target: { columnIndex: 1, rowIndex: 0 } },
      },
    });
    const receivedA = await updateA;

    expect(receivedA.events).toEqual([
      {
        type: 'HERO_MOVED',
        payload: {
          heroId: HERO_A.id,
          path: [
            { columnIndex: 0, rowIndex: 0 },
            { columnIndex: 1, rowIndex: 0 },
          ],
          heroSteps: 1,
        },
      },
    ]);
    expect(receivedA.state.heroes[HERO_A.id]).toMatchObject({
      coordinates: { columnIndex: 1, rowIndex: 0 },
    });

    const ownershipError = waitFor<{ message: string }>(clientA, 'error');
    clientA.emit('command', {
      scenarioId,
      command: {
        type: 'MOVE_HERO',
        payload: { heroId: HERO_B.id, target: { columnIndex: 2, rowIndex: 0 } },
      },
    });
    const errorPayload = await ownershipError;
    expect(errorPayload.message).toMatch(/do not control/);

    clientA.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].scenariosId).toBe(scenarioId);

    const clientC: ClientSocket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenA },
    });
    await waitFor(clientC, 'connect');
    clientC.emit('join-scenario', { scenarioId });
    const syncC = await waitFor<SnapshotPayload>(clientC, 'state-sync');

    expect(syncC.heroes[HERO_A.id]).toMatchObject({ coordinates: { columnIndex: 1, rowIndex: 0 } });
    clientC.disconnect();
  });

  it('rate-limits a socket that sends too many commands too fast', async () => {
    const tokenA = await jwtService.signAsync({ sub: 'user-a' });
    const clientD: ClientSocket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: tokenA },
    });
    await waitFor(clientD, 'connect');

    const errors: Array<{ message: string }> = [];
    clientD.on('error', (payload: { message: string }) => errors.push(payload));

    for (let i = 0; i < 11; i += 1) {
      clientD.emit('command', {
        scenarioId: 'not-joined',
        command: { type: 'WORLD_TICK', payload: { now: Date.now() } },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(errors).toHaveLength(11);
    expect(errors.slice(0, 10).every((e) => !/too many commands/i.test(e.message))).toBe(true);
    expect(errors[10].message).toMatch(/too many commands/i);

    clientD.disconnect();
  });
});
