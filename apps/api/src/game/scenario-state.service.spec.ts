import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { serializeState, type HexEngineState } from '@hexoflat/engine';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import type { Db } from '../db/db.module';
import type { HeroesService } from '../heroes/heroes.service';
import { GameEngineService } from './game-engine.service';
import { ScenarioStateService } from './scenario-state.service';

interface FakeSnapshotRow {
  state: unknown;
  createdAt: string;
}

function createFakeDb(seedRows: FakeSnapshotRow[] = []) {
  const rows = [...seedRows];
  const inserted: Array<{ scenariosId: string; saveId: string | null; state: unknown }> = [];

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (row: { scenariosId: string; saveId: string | null; state: unknown }) => {
        inserted.push(row);
        rows.unshift({ state: row.state, createdAt: new Date().toISOString() });
        return Promise.resolve();
      },
    }),
  };

  return { db: db as unknown as Db, rows, inserted };
}

function createFakeHeroesService(hero: IHero | null): HeroesService {
  return { findByUserId: vi.fn(() => Promise.resolve(hero)) } as unknown as HeroesService;
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
      const { db } = createFakeDb([
        { state: serializeState(seedState), createdAt: new Date().toISOString() },
      ]);
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
