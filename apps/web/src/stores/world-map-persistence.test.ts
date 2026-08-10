import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { useWorldMapStore } from './world-map-store';
import { useCombatStore } from './combat-store';

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
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 0 };

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
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const written = JSON.parse(localStorage.getItem(MAP_KEY('map-b'))!) as {
        contentVersion: number;
        map: { tiles: unknown[] };
      };

      expect(written.contentVersion).toBe(CONTENT_VERSION);
      expect(written.map.tiles).toHaveLength(4);
    });

    it('folds the combat snapshot into the same state blob as heroCoordinates', () => {
      const worldStore = useWorldMapStore();
      const combatStore = useCombatStore();
      worldStore.map = buildMap('combat-blob');
      worldStore.currentMapId = 'map-c';
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 1 };
      combatStore.combatActive = true;
      combatStore.combatStepsLeft = 3;
      combatStore.combatTurnSide = 'enemy';

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-c'))!) as Record<
        string,
        unknown
      >;

      expect(state.contentVersion).toBe(CONTENT_VERSION);
      expect(state.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 1 });
      expect(state.combatActive).toBe(true);
      expect(state.combatStepsLeft).toBe(3);
      expect(state.combatTurnSide).toBe('enemy');
    });

    it('snapshots state at call time, not at flush time', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('snapshot-timing');
      worldStore.currentMapId = 'map-d';
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      worldStore.saveToStorage();
      worldStore.heroCoordinates = { columnIndex: 9, rowIndex: 9 };
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

      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.saveToStorage();
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 0 };
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

      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.saveToStorage('map-left');
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 1 };
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
      worldStore.heroCoordinates = { columnIndex: 2, rowIndex: 2 };

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(localStorage.getItem(MAP_KEY('map-f'))).toBeNull();
      expect(localStorage.getItem(STATE_KEY('map-f'))).not.toBeNull();
    });
  });
});

describe('world persistence: combat autosave (characterization)', () => {
  useIsolatedWorld();

  describe('combat autosave', () => {
    it('persists a combat mutation without combat-store asking for a save', async () => {
      const worldStore = useWorldMapStore();
      const combatStore = useCombatStore();
      worldStore.map = buildMap('autosave');
      worldStore.currentMapId = 'map-auto';
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.enableCombatAutosave();

      combatStore.combatActive = true;
      combatStore.combatStepsLeft = 5;
      await nextTick();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      const state = JSON.parse(localStorage.getItem(STATE_KEY('map-auto'))!) as Record<
        string,
        unknown
      >;

      expect(state.combatActive).toBe(true);
      expect(state.combatStepsLeft).toBe(5);
    });

    it('does not write anything back while loadFromStorage is hydrating combat', async () => {
      const worldStore = useWorldMapStore();
      worldStore.map = buildMap('no-write-on-load');
      worldStore.currentMapId = 'map-load';
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 0 };
      useCombatStore().combatActive = true;
      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      setActivePinia(createPinia());
      const reloaded = useWorldMapStore();
      reloaded.currentMapId = 'map-load';
      reloaded.enableCombatAutosave();

      localStorage.removeItem(STATE_KEY('map-load'));
      reloaded.loadFromStorage('map-load');
      await nextTick();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      // The only writes allowed here are loadFromStorage's own explicit
      // saves. Hydrating combat must not itself trigger one.
      expect(useCombatStore().combatActive).toBe(false);
    });
  });
});

describe('world persistence: loadFromStorage (characterization)', () => {
  useIsolatedWorld();

  describe('loadFromStorage', () => {
    it('restores heroCoordinates and combat state written by saveToStorage', () => {
      const worldStore = useWorldMapStore();
      const combatStore = useCombatStore();
      worldStore.map = buildMap('roundtrip');
      worldStore.currentMapId = 'map-rt';
      worldStore.heroCoordinates = { columnIndex: 1, rowIndex: 1 };
      combatStore.combatActive = true;
      combatStore.combatStepsLeft = 2;

      worldStore.saveToStorage();
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      setActivePinia(createPinia());
      const reloadedWorld = useWorldMapStore();
      const reloadedCombat = useCombatStore();
      reloadedWorld.currentMapId = 'map-rt';
      reloadedWorld.loadFromStorage('map-rt');

      expect(reloadedWorld.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 1 });
      expect(reloadedWorld.map?.tiles).toHaveLength(4);
      expect(reloadedCombat.combatActive).toBe(true);
      expect(reloadedCombat.combatStepsLeft).toBe(2);
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

      expect(worldStore.heroCoordinates).toBeNull();
      expect(localStorage.getItem(STATE_KEY('stale-state'))).toBeNull();
      warn.mockRestore();
    });

    it('resets combat to defaults when there is no saved state at all', () => {
      const combatStore = useCombatStore();
      combatStore.combatActive = true;
      combatStore.combatStepsLeft = 4;

      useWorldMapStore().loadFromStorage('absent');

      expect(combatStore.combatActive).toBe(false);
      expect(combatStore.combatStepsLeft).toBe(0);
    });
  });
});
