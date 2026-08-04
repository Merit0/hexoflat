import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeState, type HexEngineState } from '@hexoflat/engine';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { scenarios } from '../db/schema';
import type { Db } from '../db/db.module';
import type { HeroesService } from '../heroes/heroes.service';
import { GameEngineService } from './game-engine.service';
import { ScenarioStateService } from './scenario-state.service';

interface FakeSnapshotRow {
  state: unknown;
  checksum: string;
  createdAt: string;
}

function createFakeDb(
  opts: { seedRows?: FakeSnapshotRow[]; scenarioOwnerId?: string | null } = {},
) {
  const rows = [...(opts.seedRows ?? [])];
  const scenarioOwnerId = opts.scenarioOwnerId ?? null;
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
                limit: () => Promise.resolve(scenarioOwnerId ? [{ ownerId: scenarioOwnerId }] : []),
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
    // The fake IS the transaction — every table op above already resolves
    // synchronously against the same in-memory arrays, so there's nothing a
    // real rollback-capable tx would add for these tests.
    transaction: (fn: (tx: Db) => Promise<void>) => fn(db as unknown as Db),
  };

  return { db: db as unknown as Db, rows, inserted };
}

function createFakeHeroesService(hero: IHero | null): HeroesService {
  return {
    findByUserId: vi.fn(() => Promise.resolve(hero)),
    updateLocation: vi.fn(() => Promise.resolve()),
  } as unknown as HeroesService;
}

const HERO: IHero = {
  id: 'hero-1',
  name: 'Merito',
  currentHealth: 10,
  maxHealth: 10,
  attack: 2,
  defense: 1,
  coins: 0,
  kills: 0,
  currentEnergy: 100,
  maxEnergy: 100,
  imgPath: '/hero.png',
  heroLocation: { columnIndex: 3, rowIndex: 4 },
  heroSteps: 7,
};

describe('ScenarioStateService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getScenarioOwnerId', () => {
    it("resolves the owning campaign's ownerId", async () => {
      const ownerId = randomUUID();
      const { db } = createFakeDb({ scenarioOwnerId: ownerId });
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      expect(await service.getScenarioOwnerId(randomUUID())).toBe(ownerId);
    });

    it('resolves null when the scenario has no owning campaign', async () => {
      const { db } = createFakeDb({ scenarioOwnerId: null });
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      expect(await service.getScenarioOwnerId(randomUUID())).toBeNull();
    });
  });

  describe('getOrCreate', () => {
    it('bootstraps a fresh homeland map when no snapshot exists', async () => {
      const { db } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      const state = await service.getOrCreate(randomUUID());

      expect(state.heroes).toEqual({});
      expect(state.map).toBeInstanceOf(HexMapModel);
      expect(state.map.name).toBe('Silesia');
    });

    it('restores the latest snapshot for the scenario', async () => {
      const seedMap = new HexMapModel();
      seedMap.name = 'seeded-map';
      const seedState: HexEngineState = {
        map: seedMap,
        heroes: {
          'hero-1': {
            id: 'hero-1',
            controlledBy: 'user-1',
            coordinates: HERO.heroLocation,
            heroSteps: HERO.heroSteps,
          },
        },
      };
      const seedPayload = serializeState(seedState);
      const { db } = createFakeDb({
        seedRows: [
          {
            state: seedPayload,
            checksum: seedPayload.checksum,
            createdAt: new Date().toISOString(),
          },
        ],
      });
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      const state = await service.getOrCreate(randomUUID());

      expect(state.map.name).toBe('seeded-map');
      expect(state.heroes['hero-1']).toEqual({
        id: 'hero-1',
        controlledBy: 'user-1',
        coordinates: HERO.heroLocation,
        heroSteps: HERO.heroSteps,
      });
    });

    it('caches the room in memory across calls', async () => {
      const { db } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );
      const scenarioId = randomUUID();

      const first = await service.getOrCreate(scenarioId);
      const second = await service.getOrCreate(scenarioId);

      expect(first).toBe(second);
    });
  });

  describe('autosave', () => {
    it('periodically snapshots an active room without waiting for release', async () => {
      vi.useFakeTimers();
      const { db, inserted } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );
      const scenarioId = randomUUID();

      await service.getOrCreate(scenarioId);
      expect(inserted).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(inserted).toHaveLength(1);
      expect(inserted[0].scenariosId).toBe(scenarioId);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(inserted).toHaveLength(2);
    });

    it('stops autosaving once the room is released', async () => {
      vi.useFakeTimers();
      const { db, inserted } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );
      const scenarioId = randomUUID();

      await service.getOrCreate(scenarioId);
      await service.release(scenarioId);
      const countAfterRelease = inserted.length;

      await vi.advanceTimersByTimeAsync(60_000);

      expect(inserted).toHaveLength(countAfterRelease);
    });
  });

  describe('ensureHero', () => {
    it('pulls the hero from HeroesService and adds it to the room', async () => {
      const { db } = createFakeDb();
      const heroesService = createFakeHeroesService(HERO);
      const service = new ScenarioStateService(db, heroesService, new GameEngineService());
      const scenarioId = randomUUID();

      await service.ensureHero(scenarioId, 'user-1', HERO.id);
      const state = await service.getOrCreate(scenarioId);

      expect(state.heroes[HERO.id]).toEqual({
        id: HERO.id,
        controlledBy: 'user-1',
        coordinates: HERO.heroLocation,
        heroSteps: HERO.heroSteps,
      });
    });

    it('is a no-op when the hero is already in the room', async () => {
      const { db } = createFakeDb();
      const heroesService = createFakeHeroesService(HERO);
      const service = new ScenarioStateService(db, heroesService, new GameEngineService());
      const scenarioId = randomUUID();

      await service.ensureHero(scenarioId, 'user-1', HERO.id);
      await service.ensureHero(scenarioId, 'user-1', HERO.id);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() reference, not `this`-bound
      expect(heroesService.findByUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispatch', () => {
    it('throws when the room has not been initialized', () => {
      const { db } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      expect(() =>
        service.dispatch(
          randomUUID(),
          {
            type: 'ADD_RESOURCE_SPAWNER',
            payload: {
              coordinates: { columnIndex: 0, rowIndex: 0 },
              hexobject: { hexobjectKey: 'tree' },
            },
          },
          {} as never,
        ),
      ).toThrow();
    });
  });

  describe('release', () => {
    it('writes a snapshot with scenariosId set and saveId null, then clears the room', async () => {
      const { db, inserted } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );
      const scenarioId = randomUUID();

      const state = await service.getOrCreate(scenarioId);
      await service.release(scenarioId);

      expect(inserted).toHaveLength(1);
      expect(inserted[0].scenariosId).toBe(scenarioId);
      expect(inserted[0].saveId).toBeNull();
      expect(inserted[0].state).toEqual(serializeState(state));
    });

    it('writes each hero in the room back to the heroes table', async () => {
      const { db } = createFakeDb();
      const heroesService = createFakeHeroesService(HERO);
      const service = new ScenarioStateService(db, heroesService, new GameEngineService());
      const scenarioId = randomUUID();

      await service.ensureHero(scenarioId, 'user-1', HERO.id);
      await service.release(scenarioId);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() reference, not `this`-bound
      expect(heroesService.updateLocation).toHaveBeenCalledWith(
        HERO.id,
        HERO.heroLocation,
        HERO.heroSteps,
        expect.anything(),
      );
    });

    it('is a no-op when the room does not exist', async () => {
      const { db, inserted } = createFakeDb();
      const service = new ScenarioStateService(
        db,
        createFakeHeroesService(null),
        new GameEngineService(),
      );

      await service.release(randomUUID());

      expect(inserted).toHaveLength(0);
    });
  });
});
