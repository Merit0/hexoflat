import { defineStore } from 'pinia';
import HexMapModel, { type ISerializedHexMap } from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { coordinateKey, getOddQNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { EHexCollision } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useGatheringStore } from '@/stores/gathering-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import {
  LocationKey,
  MapDefinition,
  MapRegistry,
} from '@hexoflat/engine/registry/world-map-registry';
import { IHexMapPlacement } from '@hexoflat/engine/abstraction/hex-map-placement';
import { getReachableTileDistances } from '@hexoflat/engine/hero-movement/reachable-range-service';
import { findShortestPath } from '@hexoflat/engine/hero-movement/pathfinding-service';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import { executeMovementRoute } from '@/services/hero-movement/movement-executor';
import router, { ROUTES } from '@/router';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { CONTENT_VERSION, applyCommand } from '@hexoflat/engine';
import type { HexEngineActionContext } from '@hexoflat/engine';
import type { IWorldMapPort } from '@hexoflat/engine/abstraction/abstract-action';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import {
  clearLocationMapIndex,
  newMapId,
  readLocationMapIndex,
  readRespawnSchedule,
  writeLocationMapIndex,
  writeRespawnSchedule,
} from '@/stores/world-persistence';
import { useCombatStore, type CombatSnapshot } from '@/stores/combat-store';

type TWorldState = {
  contentVersion: number;
  heroCoordinates: IHexCoordinates | null;
} & CombatSnapshot;

function initialLocationKey(): LocationKey {
  return 'camping';
}

const STORAGE_MAP_PREFIX = 'hexoflat:world:map:v1:';
const STORAGE_STATE_PREFIX = 'hexoflat:world:state:v1:';
const SAVE_DEBOUNCE_MS = 750;

let worldTimer: number | null = null;

// Tile ids touched since the renderer last flushed — lets use-hex-board.ts's
// tiles-layer watcher recompute only the tiles that actually changed instead
// of deep-walking the whole tiles array on every mutation. Kept module-level
// (not reactive state) since only the `dirtyTick` counter below needs to be
// a Vue-tracked signal; the ids themselves are read once per flush.
const dirtyTileIds = new Set<string>();

interface PendingSave {
  mapSnapshot: string | null;
  stateSnapshot: string;
  timer: number;
}

// Keyed by mapId so a save for one map (e.g. the map being left on
// navigation) can never be dropped by a debounced save for another map
// racing it — only redundant saves to the *same* map collapse together.
const pendingSaves = new Map<string, PendingSave>();

function flushPendingSave(mapId: string, save: PendingSave) {
  if (save.mapSnapshot) localStorage.setItem(STORAGE_MAP_PREFIX + mapId, save.mapSnapshot);
  localStorage.setItem(STORAGE_STATE_PREFIX + mapId, save.stateSnapshot);
}

// Debounced writes are still pending in memory until their timer fires — flush
// them immediately so a tab close doesn't silently lose the last ~750ms of state.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const [mapId, save] of pendingSaves) {
      window.clearTimeout(save.timer);
      flushPendingSave(mapId, save);
    }
    pendingSaves.clear();
  });
}

export function runWorldTick(map: HexMapModel, now: number, ctx: HexEngineActionContext): boolean {
  const { events } = applyCommand(
    { map, heroes: {} },
    { type: 'WORLD_TICK', payload: { now } },
    ctx,
  );
  const tickEvent = events.find((e) => e.type === 'WORLD_TICKED') as
    { type: 'WORLD_TICKED'; payload: { changed: boolean } } | undefined;

  return tickEvent?.payload.changed ?? false;
}

export const useWorldMapStore = defineStore('world-map-store', {
  state: () => ({
    map: null as HexMapModel | null,
    heroCoordinates: null as IHexCoordinates | null,
    woodCollected: 0,
    isHeroMoving: false,
    pendingCampingRespawn: false,

    currentLocationKey: initialLocationKey(),
    currentMapId: null as string | null,

    // Bumped whenever dirtyTileIds gains entries — the render layer watches
    // this (cheap, shallow) instead of deep-watching the tiles array itself.
    dirtyTick: 0,
  }),

  actions: {
    /**
     * Builds the port context @hexoflat/engine's applyCommand needs. The
     * `worldMap` port is an adapter over two stores: combat fields/actions
     * come from combat-store, navigation (isLocationRespawning/goToLocation)
     * stays here — tracked follow-up debt per docs/MIGRATION-PLAN.md Phase 2
     * (staged scope) to move this off Pinia stores entirely.
     */
    buildEngineContext(): HexEngineActionContext {
      const combatStore = useCombatStore();
      const worldMap: IWorldMapPort = {
        get combatActive() {
          return combatStore.combatActive;
        },
        performHeroCombatAttack: (tile, toolKey) =>
          combatStore.performHeroCombatAttack(tile, toolKey),
        placeCombatDefendMarker: (target, toolKey) =>
          combatStore.placeCombatDefendMarker(target, toolKey),
        isLocationRespawning: (locationKey) => this.isLocationRespawning(locationKey),
        getLocationRespawnRemainingMs: (locationKey) =>
          this.getLocationRespawnRemainingMs(locationKey),
        goToLocation: (locationKey) => this.goToLocation(locationKey),
      };

      return {
        heroToolStore: useHeroToolStore(),
        hero: useHeroStore(),
        gathering: useGatheringStore(),
        inventory: useHeroInventoryStore(),
        events: useGameEventsStore(),
        worldMap,
        navigate: (locationKey) => {
          void router
            .push({ name: ROUTES.WORLD, params: { locationKey } })
            .catch((e: unknown) => console.error('Router push failed:', e));
        },
      };
    },

    markTileDirty(coordinates: IHexCoordinates) {
      dirtyTileIds.add(coordinateKey(coordinates));
      this.dirtyTick += 1;
    },

    markTilesDirty(coordinatesList: IHexCoordinates[]) {
      if (!coordinatesList.length) return;
      for (const c of coordinatesList) dirtyTileIds.add(coordinateKey(c));
      this.dirtyTick += 1;
    },

    // Safety net for whole-map changes (fresh map creation, loading from
    // storage, a WORLD_TICK reporting `changed` with no per-tile detail) —
    // anywhere the exact set of touched tiles isn't cheaply knowable.
    markAllTilesDirty() {
      if (!this.map) return;
      for (const t of this.map.tiles) dirtyTileIds.add(coordinateKey(t.coordinates));
      this.dirtyTick += 1;
    },

    // Called once per render flush by the tiles-layer watcher — hands over
    // the accumulated ids and clears them so the next mutation starts fresh.
    consumeDirtyTileIds(): Set<string> {
      const ids = new Set(dirtyTileIds);
      dirtyTileIds.clear();
      return ids;
    },

    executeHexAction(
      tile: HexTileModel,
      actionType: EHexActionType,
      toolKey: THeroToolKey,
    ): { ok: boolean; message?: string } {
      if (!this.map) return { ok: false, message: 'No active map.' };

      const { events } = applyCommand(
        { map: this.map as HexMapModel, heroes: {} },
        {
          type: 'START_HEX_ACTION',
          payload: {
            heroId: useHeroStore().hero.id,
            coordinates: tile.coordinates,
            actionType,
            toolKey,
            now: Date.now(),
          },
        },
        this.buildEngineContext(),
      );
      this.markTileDirty(tile.coordinates);

      if (events.some((e) => e.type === 'HEX_ACTION_STARTED')) {
        return { ok: true };
      }

      const rejected = events.find((e) => e.type === 'HEX_ACTION_START_REJECTED') as
        { type: 'HEX_ACTION_START_REJECTED'; payload: { message: string } } | undefined;

      return { ok: false, message: rejected?.payload.message };
    },

    getTileAt(coords: IHexCoordinates): HexTileModel | null {
      if (!this.map) return null;
      const tiles = this.map.tiles as HexTileModel[];

      return (
        tiles.find(
          (t: HexTileModel) =>
            t.coordinates.columnIndex === coords.columnIndex &&
            t.coordinates.rowIndex === coords.rowIndex,
        ) ?? null
      );
    },

    clearStoredLocation(locationKey: LocationKey, mapId: string) {
      const heroStore = useHeroStore();
      const index = readLocationMapIndex();

      localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
      localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);

      if (index[locationKey] === mapId) {
        delete index[locationKey];
        writeLocationMapIndex(index);
      }

      heroStore.forgetPosition(mapId);
    },

    forgetStoredLocationPosition(locationKey: LocationKey) {
      const heroStore = useHeroStore();
      const index = readLocationMapIndex();
      const mapId = index[locationKey];

      if (!mapId) return;

      heroStore.forgetPosition(mapId);
    },

    scheduleLocationRespawn(locationKey: LocationKey, delayMs: number) {
      const schedule = readRespawnSchedule();
      schedule[locationKey] = Date.now() + delayMs;
      writeRespawnSchedule(schedule);
    },

    clearLocationRespawn(locationKey: LocationKey) {
      const schedule = readRespawnSchedule();
      if (!(locationKey in schedule)) return;
      delete schedule[locationKey];
      writeRespawnSchedule(schedule);
    },

    getLocationRespawnRemainingMs(locationKey: LocationKey) {
      const schedule = readRespawnSchedule();
      const respawnAt = schedule[locationKey];
      if (!respawnAt) return 0;

      return Math.max(0, respawnAt - Date.now());
    },

    isLocationRespawning(locationKey: LocationKey) {
      return this.getLocationRespawnRemainingMs(locationKey) > 0;
    },

    syncLocationRespawn(locationKey: LocationKey) {
      const schedule = readRespawnSchedule();
      const respawnAt = schedule[locationKey];
      if (!respawnAt) return;
      if (Date.now() < respawnAt) return;

      const index = readLocationMapIndex();
      const mapId = index[locationKey];
      if (mapId) {
        this.clearStoredLocation(locationKey, mapId);
      }

      delete schedule[locationKey];
      writeRespawnSchedule(schedule);
    },

    hasGraveMarker() {
      if (!this.map) return false;
      const map = this.map as HexMapModel;
      return map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE);
    },

    placeHeroAtCampfire() {
      if (!this.map) return;
      const map = this.map as HexMapModel;

      const campfireTile = map.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE,
      );

      if (!campfireTile) {
        this.placeHeroAtEntry('camping');
        return;
      }

      const byKey = new Map<string, HexTileModel>();
      for (const tile of map.tiles) {
        byKey.set(coordinateKey(tile.coordinates), tile);
      }

      const neighbor = getOddQNeighbors(campfireTile.coordinates)
        .map((coord) => byKey.get(coordinateKey(coord)))
        .find((tile) => tile && tile.hexobject?.collision !== EHexCollision.SOLID);

      this.heroCoordinates = neighbor
        ? { ...neighbor.coordinates }
        : { ...campfireTile.coordinates };
    },

    async respawnHeroAtCamping() {
      const heroStore = useHeroStore();
      const events = useGameEventsStore();
      const combatStore = useCombatStore();
      const defeatedLocationKey = this.currentLocationKey;
      const defeatedMapId = this.currentMapId;

      combatStore.endCombat();
      if (defeatedMapId) {
        this.clearStoredLocation(defeatedLocationKey, defeatedMapId);
      }
      this.forgetStoredLocationPosition('silesia');

      this.stopWorldLoop();
      this.pendingCampingRespawn = true;
      this.heroCoordinates = null;
      this.currentMapId = null;
      heroStore.setPendingLocation('camping');
      heroStore.reviveAtOneHp();
      events.push('Combat', 'hero was defeated and returned to camping', 'INFO');

      if (
        router.currentRoute.value.name === ROUTES.WORLD &&
        router.currentRoute.value.params.locationKey !== 'camping'
      ) {
        await router.push({
          name: ROUTES.WORLD,
          params: { locationKey: 'camping' },
        });
        return;
      }

      this.goToLocation('camping');
    },

    bootstrapWorld() {
      const heroStore = useHeroStore();

      const locationKey = heroStore.nav.locationKey;
      const mapId = heroStore.nav.locationMapId ?? undefined;

      this.goToLocation(locationKey, mapId);

      if (this.currentMapId) {
        const remembered = heroStore.nav.positionByMapId[this.currentMapId];
        if (remembered) {
          this.heroCoordinates = { ...remembered };
          this.revealAroundHero();
          this.saveToStorage(this.currentMapId);
        }
      }
    },

    goToLocation(locationKey: LocationKey, preferredMapId?: string) {
      const heroStore = useHeroStore();

      if (locationKey !== this.currentLocationKey && this.isLocationRespawning(locationKey)) {
        useGameEventsStore().push(
          'World',
          `${MapRegistry.get(locationKey).title} is sealed for now.`,
          'INFO',
        );
        return;
      }

      if (this.currentLocationKey === 'cave' && locationKey !== 'cave' && this.hasGraveMarker()) {
        this.scheduleLocationRespawn('cave', 60_000);
      }

      if (this.currentMapId && this.heroCoordinates) {
        heroStore.rememberPosition(this.currentMapId, this.heroCoordinates);
      }
      if (this.currentMapId) this.saveToStorage(this.currentMapId);

      this.stopWorldLoop();
      this.openLocation(locationKey, preferredMapId);

      if (!this.currentMapId) return;

      const remembered = heroStore.nav.positionByMapId[this.currentMapId];

      if (this.pendingCampingRespawn && locationKey === 'camping') {
        this.placeHeroAtCampfire();
      } else if (remembered) {
        this.heroCoordinates = { ...remembered };
      } else {
        this.placeHeroAtEntry(locationKey);
      }

      this.pendingCampingRespawn = false;
      this.revealAroundHero();
      this.revealEntryTile();
      this.saveToStorage(this.currentMapId);
    },

    revealEntryTile() {
      if (!this.map) return;
      const map = this.map as HexMapModel;

      const entryPlacement: IHexMapPlacement | undefined =
        map.config?.find((p: IHexMapPlacement) => p.entry?.type === 'DEFAULT') ??
        map.config?.find((p: IHexMapPlacement) => p.entry?.type === 'SECRET');

      const entryPlaceCoordinates: IHexCoordinates | undefined = entryPlacement?.coordinates?.[0];
      if (!entryPlaceCoordinates) return;

      const entryTile = map.tiles.find(
        (t: HexTileModel) =>
          t.coordinates.columnIndex === entryPlaceCoordinates.columnIndex &&
          t.coordinates.rowIndex === entryPlaceCoordinates.rowIndex,
      );

      if (entryTile) {
        entryTile.isRevealed = true;
        this.markTileDirty(entryTile.coordinates);
      }
    },

    openLocation(locationKey: LocationKey, preferredMapId?: string) {
      const heroStore = useHeroStore();

      this.syncLocationRespawn(locationKey);

      const index = readLocationMapIndex();
      const mapId = preferredMapId ?? index[locationKey] ?? newMapId();

      if (!index[locationKey]) {
        index[locationKey] = mapId;
        writeLocationMapIndex(index);
      }

      this.currentLocationKey = locationKey;
      this.currentMapId = mapId;

      this.loadFromStorage(mapId);

      if (!this.map) {
        const def = MapRegistry.get(locationKey);
        this.map = def.create();

        this.initFog();

        this.hydrateResourcesFromConfig();

        this.saveToStorage(mapId);
      }

      // Safety net for the tiles-layer's dirty-tracking: a location switch
      // swaps in a wholly different tile set, which per-mutation dirty
      // marking elsewhere in this file won't necessarily cover on its own.
      this.markAllTilesDirty();

      this.startWorldLoop();
      heroStore.setLocation(locationKey, mapId);
    },

    loadFromStorage(mapId: string) {
      const combatStore = useCombatStore();

      const savedMap = localStorage.getItem(STORAGE_MAP_PREFIX + mapId);
      const parsedMap = savedMap
        ? (JSON.parse(savedMap) as { contentVersion?: number; map?: ISerializedHexMap })
        : null;

      if (parsedMap?.map && parsedMap.contentVersion === CONTENT_VERSION) {
        const loadedAt = Date.now();
        const hydratedMap = HexMapModel.fromJSON(parsedMap.map, loadedAt);
        this.map = hydratedMap;
        this.hydrateResourcesFromConfig();

        const changed = runWorldTick(hydratedMap, loadedAt, this.buildEngineContext());
        if (changed) {
          this.markAllTilesDirty();
          this.saveToStorage(mapId);
        }
      } else {
        if (parsedMap) {
          console.warn(
            `[world-map-store] Discarding saved map for "${mapId}": content version mismatch.`,
          );
          localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
        }
        this.map = null;
      }

      const savedState = localStorage.getItem(STORAGE_STATE_PREFIX + mapId);
      const raw = savedState ? (JSON.parse(savedState) as Partial<TWorldState>) : null;

      if (raw && raw.contentVersion === CONTENT_VERSION) {
        this.heroCoordinates = raw.heroCoordinates ?? null;
        combatStore.hydrate({
          combatActive: raw.combatActive ?? false,
          combatTurnSide: raw.combatTurnSide ?? 'hero',
          combatStepsLeft: raw.combatStepsLeft ?? 0,
          combatStoredStepsBeforeDefend: raw.combatStoredStepsBeforeDefend ?? null,
          combatTurnEndsAt: raw.combatTurnEndsAt ?? null,
          combatActionMode: raw.combatActionMode ?? null,
          combatAttackUsed: raw.combatAttackUsed ?? false,
          combatDefendUsed: raw.combatDefendUsed ?? false,
          combatMarkers:
            raw.combatMarkers?.map((marker) => ({
              owner: marker.owner,
              coord: { ...marker.coord },
              kind: marker.kind,
              visible: marker.visible ?? true,
              toolKey: marker.toolKey ?? null,
            })) ?? [],
        });
      } else {
        if (raw) {
          console.warn(
            `[world-map-store] Discarding saved world state for "${mapId}": content version mismatch.`,
          );
          localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
        }
        this.heroCoordinates = null;
        this.woodCollected = 0;
        combatStore.resetToDefaults();
      }

      if (!this.map) return;
      const map = this.map as HexMapModel;

      if (!this.heroCoordinates) {
        const def = MapRegistry.get(this.currentLocationKey);

        const entryTile = map.tiles.find(
          (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey,
        );

        if (entryTile) {
          const byKey = new Map<string, HexTileModel>();
          for (const t of map.tiles) {
            byKey.set(coordinateKey(t.coordinates), t);
          }

          const neighbor = getOddQNeighbors(entryTile.coordinates)
            .map((c) => byKey.get(coordinateKey(c)))
            .find((t) => t && t.hexobject?.collision !== EHexCollision.SOLID);

          this.heroCoordinates = neighbor
            ? { ...neighbor.coordinates }
            : { ...entryTile.coordinates };
        } else {
          this.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
        }

        this.revealAroundHero();
        this.saveToStorage(mapId);
        return;
      }

      this.revealAroundHero();
      if (combatStore.combatActive) {
        combatStore.revealCombatVision();
      }
    },

    saveToStorage(mapId?: string) {
      const targetMapId = mapId ?? this.currentMapId;
      if (!targetMapId) return;

      // Snapshot now, while `this.map`/`this.heroCoordinates` are still the
      // values this call was meant to persist — the actual localStorage
      // write is what gets debounced, not the read of current state.
      const mapSnapshot = this.map
        ? JSON.stringify({ contentVersion: CONTENT_VERSION, map: this.map })
        : null;
      const state: TWorldState = {
        contentVersion: CONTENT_VERSION,
        heroCoordinates: this.heroCoordinates,
        ...useCombatStore().toSnapshot(),
      };
      const stateSnapshot = JSON.stringify(state);

      const existing = pendingSaves.get(targetMapId);
      if (existing) window.clearTimeout(existing.timer);

      const timer = window.setTimeout(() => {
        const save = pendingSaves.get(targetMapId);
        pendingSaves.delete(targetMapId);
        if (save) flushPendingSave(targetMapId, save);
      }, SAVE_DEBOUNCE_MS);

      pendingSaves.set(targetMapId, { mapSnapshot, stateSnapshot, timer });
    },

    startWorldLoop() {
      if (worldTimer) return;

      worldTimer = window.setInterval(() => {
        if (!this.map || !this.currentMapId) return;
        const changed = runWorldTick(
          this.map as HexMapModel,
          Date.now(),
          this.buildEngineContext(),
        );
        if (changed) {
          this.markAllTilesDirty();
          this.saveToStorage(this.currentMapId);
        }
      }, 250);
    },

    stopWorldLoop() {
      if (worldTimer) {
        clearInterval(worldTimer);
        worldTimer = null;
      }
    },

    placeHeroAtEntry(locationKey: LocationKey) {
      if (!this.map) return;
      const map = this.map as HexMapModel;

      const def: MapDefinition = MapRegistry.get(locationKey);
      const entryTile = map.tiles.find(
        (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey,
      );

      if (!entryTile) {
        this.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
        return;
      }

      const byKey = new Map<string, HexTileModel>();
      for (const t of map.tiles) {
        byKey.set(coordinateKey(t.coordinates), t);
      }

      const neighbors = getOddQNeighbors(entryTile.coordinates)
        .map((c) => byKey.get(coordinateKey(c)))
        .filter((t): t is HexTileModel => !!t)
        .filter((t) => t.hexobject?.collision !== EHexCollision.SOLID);

      const chosen = neighbors.length
        ? neighbors[Math.floor(Math.random() * neighbors.length)]
        : entryTile;

      this.heroCoordinates = { ...chosen.coordinates };
    },

    initFog() {
      if (!this.map) return;

      const all = this.map.fogPolicy === 'ALL_REVEALED';
      for (const t of this.map.tiles) t.isRevealed = all;
      this.markAllTilesDirty();
    },

    revealAroundHero() {
      if (!this.map || !this.heroCoordinates) return;
      const map = this.map as HexMapModel;

      const byKey = new Map<string, HexTileModel>();
      for (const t of map.tiles) byKey.set(coordinateKey(t.coordinates), t);

      const coords = [this.heroCoordinates, ...getOddQNeighbors(this.heroCoordinates)];
      const revealedCoords: IHexCoordinates[] = [];

      for (const c of coords) {
        const tile = byKey.get(coordinateKey(c));
        if (tile) {
          tile.isRevealed = true;
          revealedCoords.push(tile.coordinates);
        }
      }

      this.markTilesDirty(revealedCoords);
    },

    async moveHeroTo(target: IHexCoordinates): Promise<boolean> {
      const heroToolStore = useHeroToolStore();
      const heroStore = useHeroStore();
      const events = useGameEventsStore();
      const combatStore = useCombatStore();

      if (!this.map || !this.heroCoordinates) return false;
      if (heroToolStore.isDragging || this.isHeroMoving) return false;
      if (combatStore.combatActive && combatStore.combatTurnSide !== 'hero') return false;
      if (combatStore.combatActive && combatStore.combatStepsLeft <= 0) return false;

      const map = this.map as HexMapModel;
      const tile = map.tiles.find(
        (t: HexTileModel) =>
          t.coordinates.columnIndex === target.columnIndex &&
          t.coordinates.rowIndex === target.rowIndex,
      );
      if (!tile || !tile.isRevealed) return false;
      if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
      if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING_ENTRANCE) return false;

      let path: IHexCoordinates[] | null | undefined;

      if (combatStore.combatActive) {
        const moveSteps = combatStore.combatStepsLeft;
        const reachable = getReachableTileDistances(map, this.heroCoordinates, moveSteps);
        const targetKey = coordinateKey(target);
        if (!reachable.has(targetKey)) return false;

        path = findShortestPath(map, this.heroCoordinates, target, moveSteps);
        if (!path || path.length < 2) return false;
      } else {
        const heroState: HeroState = {
          id: heroStore.hero.id,
          controlledBy: null,
          coordinates: this.heroCoordinates,
          heroSteps: heroStore.hero.heroSteps ?? 0,
        };

        const { events: moveEvents } = applyCommand(
          { map, heroes: { [heroState.id]: heroState } },
          { type: 'MOVE_HERO', payload: { heroId: heroState.id, target } },
          this.buildEngineContext(),
        );

        const moved = moveEvents.find((e) => e.type === 'HERO_MOVED') as
          | {
              type: 'HERO_MOVED';
              payload: { heroId: string; path: IHexCoordinates[]; heroSteps: number };
            }
          | undefined;
        if (!moved) return false;

        path = moved.payload.path;
      }

      const route = path.slice(1);
      let stepsTaken = 0;

      if (heroToolStore.isLocked) {
        heroToolStore.cancelLockedAction('MOVE');
        this.saveToStorage();
      }

      this.isHeroMoving = true;

      try {
        await executeMovementRoute(route, (coord) => {
          this.heroCoordinates = { ...coord };
          stepsTaken += 1;
          if (combatStore.combatActive) {
            combatStore.combatStepsLeft = Math.max(0, combatStore.combatStepsLeft - 1);
            combatStore.clearCombatAttackTrace();
          }
          heroStore.hero?.makeStep();
          heroStore.saveProgressToStorage();

          this.revealAroundHero();
          if (combatStore.combatActive) {
            combatStore.syncEnemyAutoDefend();
          }
          this.saveToStorage();

          if (this.currentMapId && this.heroCoordinates) {
            heroStore.rememberPosition(this.currentMapId, this.heroCoordinates);
          }

          if (combatStore.combatActive && combatStore.combatStepsLeft <= 0) {
            return false;
          }
        });
      } finally {
        this.isHeroMoving = false;
      }

      events.push(
        heroStore.hero?.name ?? 'Hero',
        `moved to [${this.heroCoordinates.columnIndex}, ${this.heroCoordinates.rowIndex}] by ${stepsTaken} step(s)`,
        'INFO',
      );

      return true;
    },

    revealTile(tileCoordinates: IHexCoordinates) {
      if (!this.map || !this.heroCoordinates) return;
      const map = this.map as HexMapModel;

      const tile = map.tiles.find(
        (t: HexTileModel) =>
          t.coordinates.columnIndex === tileCoordinates.columnIndex &&
          t.coordinates.rowIndex === tileCoordinates.rowIndex,
      );
      if (!tile) return;

      if (tile.isRevealed) return;

      const isHeroTile =
        tile.coordinates.columnIndex === this.heroCoordinates.columnIndex &&
        tile.coordinates.rowIndex === this.heroCoordinates.rowIndex;

      if (isHeroTile) return;

      const neighbors = getOddQNeighbors(this.heroCoordinates);
      const isNeighbor = neighbors.some(
        (n) =>
          n.columnIndex === tile.coordinates.columnIndex &&
          n.rowIndex === tile.coordinates.rowIndex,
      );

      if (!isNeighbor) return;

      tile.isRevealed = true;
      this.markTileDirty(tile.coordinates);
      this.saveToStorage();
    },

    hydrateResourcesFromConfig() {
      if (!this.map?.config?.length) return;
      const map = this.map as HexMapModel;

      const tileByKey = new Map<string, HexTileModel>();
      for (const t of map.tiles) {
        tileByKey.set(`${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`, t);
      }

      for (const placement of map.config) {
        for (const c of placement.coordinates) {
          const tile = tileByKey.get(`${c.columnIndex}:${c.rowIndex}`);
          if (tile && !tile.resourceSpawner) {
            applyCommand(
              { map, heroes: {} },
              {
                type: 'ADD_RESOURCE_SPAWNER',
                payload: {
                  heroId: useHeroStore().hero.id,
                  coordinates: tile.coordinates,
                  hexobject: placement.hexobject!,
                },
              },
              this.buildEngineContext(),
            );
            this.markTileDirty(tile.coordinates);
          }
        }
      }
    },

    clearAllWorlds() {
      this.stopWorldLoop();

      const index = readLocationMapIndex();
      for (const mapId of Object.values(index)) {
        localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
        localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
      }

      clearLocationMapIndex();

      this.map = null;
      this.heroCoordinates = null;
      this.currentMapId = null;
      this.currentLocationKey = 'camping';
      useCombatStore().endCombat();
    },
  },
});
