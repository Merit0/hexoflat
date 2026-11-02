import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { applyCommand, CONTENT_VERSION } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { heroBattleCreature } from '@hexoflat/engine/squads/squad-battle';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { useWorldMapStore } from './world-map-store';
import { useBattleStore } from './battle-store';
import { useHeroStore } from './hero-store';

/**
 * Characterization tests for the save/load path, written BEFORE the G2
 * persistence extraction (docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md).
 *
 * These deliberately assert the *on-disk contract* — exact key names, exact
 * envelope shape, the debounce window, and the per-mapId isolation — rather
 * than the current call structure. G2 moves this code into its own service;
 * anything these tests still pass afterwards is behaviour that genuinely
 * survived the move, which is the whole point of pinning them down first.
 */

const MAP_KEY = (mapId: string) => `hexoflat:world:map:v1:${mapId}`;
const STATE_KEY = (mapId: string) => `hexoflat:world:state:v1:${mapId}`;
const SAVE_DEBOUNCE_MS = 750;

function buildMap(name: string) {
  const map = new HexMapBuilder().name(name).width(2).height(2).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

const SQUAD_AT = { columnIndex: 2, rowIndex: 2 };

function buildBattleMap(name: string) {
  const map = new HexMapBuilder().name(name).width(5).height(5).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  map.tiles.find(
    (t) => t.coordinates.columnIndex === 2 && t.coordinates.rowIndex === 2,
  )!.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.LONE_SKELETON, SQUAD_AT);
  return map;
}

function openBattle(name: string) {
  const worldStore = useWorldMapStore();
  const hero = useHeroStore();
  worldStore.map = buildBattleMap(name);
  hero.hero.id = 'hero-1';
  hero.heroCoordinates = { columnIndex: 1, rowIndex: 2 };
  const state = {
    map: worldStore.map as HexMapModel,
    heroes: { [hero.hero.id]: hero.engineHeroState(hero.heroCoordinates) },
  } as Parameters<typeof applyCommand>[0];
  applyCommand(
    state,
    {
      type: 'START_HEX_ACTION',
      payload: {
        heroId: hero.hero.id,
        coordinates: SQUAD_AT,
        actionType: EHexActionType.ATTACK,
        toolKey: HEXOBJECT_KEYS.HAND,
        now: 0,
      },
    },
    worldStore.buildEngineContext(),
  );
  const creature = heroBattleCreature({
    id: hero.hero.id,
    hearts: 3,
    weapon: null,
    shield: null,
    bag: [],
  });
  applyCommand(
    state,
    {
      type: 'BATTLE',
      payload: { kind: 'start', heroId: hero.hero.id, atMs: 0, heroes: [creature] },
    },
    worldStore.buildEngineContext(),
  );
  useBattleStore().restore({ engagement: state.engagement!, battle: state.battle! });
  return state;
}

// Shared across the three top-level describes below. They are kept separate
// (rather than nested under one parent) so no single callback trips the G0
// max-lines-per-function ratchet.
function useIsolatedWorld() {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

describe('world persistence: saveToStorage (characterization)', () => {
  useIsolatedWorld();

  describe('saveToStorage', () => {
    it('debounces the write: nothing hits localStorage before the timer fires', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('debounce');
      worldStore.currentMapId = 'map-a';
      useHeroStore().heroCoordinates = { columnIndex: 1, rowIndex: 0 };

      worldStore.saveToStorage();

      expect(localStorage.getItem(MAP_KEY('map-a'))).toBeNull();
      expect(localStorage.getItem(STATE_KEY('map-a'))).toBeNull();

      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(localStorage.getItem(MAP_KEY('map-a'))).not.toBeNull();
      expect(localStorage.getItem(STATE_KEY('map-a'))).not.toBeNull();
    });

    it('writes the map under a versioned envelope', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('envelope');
      worldStore.currentMapId = 'map-b';
      useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const written = JSON.parse(localStorage.getItem(MAP_KEY('map-b'))!) as {
        contentVersion: number;
        map: { tiles: unknown[] };
      };

      expect(written.contentVersion).toBe(CONTENT_VERSION);
      expect(written.map.tiles).toHaveLength(4);
    });

    it('folds the battle snapshot into the same state blob as heroCoordinates', () => {
      const worldStore = useWorldMapStore();
      worldStore.currentMapId = 'map-c';
      const opened = openBattle('battle-blob');

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-c'))!) as Record<
        string,
        unknown
      >;

      expect(state.contentVersion).toBe(CONTENT_VERSION);
      expect(state.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 2 });
      expect(state.battle).toEqual(
        JSON.parse(JSON.stringify({ engagement: opened.engagement, battle: opened.battle })),
      );
    });

    it('snapshots state at call time, not at flush time', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('snapshot-timing');
      worldStore.currentMapId = 'map-d';
      useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      worldStore.saveToStorage();
      useHeroStore().heroCoordinates = { columnIndex: 9, rowIndex: 9 };
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-d'))!) as {
        heroCoordinates: unknown;
      };

      expect(state.heroCoordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
    });

    it('collapses repeated saves for the same map into one write', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('collapse');
      worldStore.currentMapId = 'map-e';

      useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.saveToStorage();
      useHeroStore().heroCoordinates = { columnIndex: 1, rowIndex: 0 };
      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-e'))!) as {
        heroCoordinates: unknown;
      };

      expect(state.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 0 });
    });

    it('keeps pending saves for different maps independent', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('two-maps');

      useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.saveToStorage('map-left');
      useHeroStore().heroCoordinates = { columnIndex: 1, rowIndex: 1 };
      worldStore.saveToStorage('map-right');
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const left = JSON.parse(localStorage.getItem(STATE_KEY('map-left'))!) as {
        heroCoordinates: unknown;
      };
      const right = JSON.parse(localStorage.getItem(STATE_KEY('map-right'))!) as {
        heroCoordinates: unknown;
      };

      expect(left.heroCoordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
      expect(right.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 1 });
    });

    it('does nothing when there is no map id to save under', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('no-id');
      worldStore.currentMapId = '';

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(localStorage.length).toBe(0);
    });

    it('writes only the state blob when there is no map in memory', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = null;
      worldStore.currentMapId = 'map-f';
      useHeroStore().heroCoordinates = { columnIndex: 2, rowIndex: 2 };

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(localStorage.getItem(MAP_KEY('map-f'))).toBeNull();
      expect(localStorage.getItem(STATE_KEY('map-f'))).not.toBeNull();
    });
  });
});

describe('world persistence: battle autosave', () => {
  useIsolatedWorld();

  describe('battle autosave', () => {
    it('persists a battle change without battle-store asking for a save', async () => {
      const worldStore = useWorldMapStore();
      worldStore.currentMapId = 'map-auto';
      worldStore.enableBattleAutosave();

      const opened = openBattle('autosave');
      await nextTick();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-auto'))!) as Record<
        string,
        unknown
      >;

      expect((state.battle as { engagement: { squadId: string } }).engagement.squadId).toBe(
        opened.engagement!.squadId,
      );
    });

    it('does not write anything back while loadFromStorage is hydrating a battle', async () => {
      const worldStore = useWorldMapStore();
      worldStore.currentMapId = 'map-load';
      openBattle('no-write-on-load');
      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      setActivePinia(createPinia());
      const reloaded = useWorldMapStore();
      reloaded.currentMapId = 'map-load';
      reloaded.enableBattleAutosave();

      localStorage.removeItem(STATE_KEY('map-load'));
      reloaded.loadFromStorage('map-load');
      await nextTick();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(useBattleStore().inBattle).toBe(false);
    });
  });
});

describe('world persistence: loadFromStorage (characterization)', () => {
  useIsolatedWorld();

  describe('loadFromStorage', () => {
    it('restores heroCoordinates and an open battle written by saveToStorage', () => {
      const worldStore = useWorldMapStore();
      worldStore.currentMapId = 'map-rt';
      const opened = openBattle('roundtrip');

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      setActivePinia(createPinia());
      const reloadedWorld = useWorldMapStore();
      const reloadedBattle = useBattleStore();
      const reloadedHero = useHeroStore();
      reloadedWorld.currentMapId = 'map-rt';
      reloadedWorld.loadFromStorage('map-rt');

      expect(reloadedHero.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 2 });
      expect(reloadedWorld.map?.tiles).toHaveLength(25);
      expect(reloadedBattle.engagement?.squadId).toBe(opened.engagement!.squadId);
      expect(reloadedBattle.battle?.id).toBe(opened.battle!.id);
    });

    it('ignores the old combat fields of a save written before B6', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('legacy');
      worldStore.currentMapId = 'map-legacy';
      useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-legacy'))!) as Record<
        string,
        unknown
      >;
      localStorage.setItem(
        STATE_KEY('map-legacy'),
        JSON.stringify({ ...state, battle: undefined, combatActive: true, combatStepsLeft: 3 }),
      );

      setActivePinia(createPinia());
      useWorldMapStore().loadFromStorage('map-legacy');

      expect(useBattleStore().inBattle).toBe(false);
      expect(useHeroStore().heroCoordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
    });

    it('discards and removes a saved map whose content version does not match', () => {
      localStorage.setItem(
        MAP_KEY('stale'),
        JSON.stringify({ contentVersion: CONTENT_VERSION - 1, map: { tiles: [] } }),
      );
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const worldStore = useWorldMapStore();
      worldStore.loadFromStorage('stale');

      expect(worldStore.map).toBeNull();
      expect(localStorage.getItem(MAP_KEY('stale'))).toBeNull();
      warn.mockRestore();
    });

    it('discards and removes saved world state whose content version does not match', () => {
      localStorage.setItem(
        STATE_KEY('stale-state'),
        JSON.stringify({
          contentVersion: CONTENT_VERSION - 1,
          heroCoordinates: { columnIndex: 5, rowIndex: 5 },
        }),
      );
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const worldStore = useWorldMapStore();
      worldStore.loadFromStorage('stale-state');

      expect(useHeroStore().heroCoordinates).toBeNull();
      expect(localStorage.getItem(STATE_KEY('stale-state'))).toBeNull();
      warn.mockRestore();
    });

    it('closes any open battle when there is no saved state at all', () => {
      openBattle('absent-battle');

      useWorldMapStore().loadFromStorage('absent');

      expect(useBattleStore().inBattle).toBe(false);
    });
  });
});
