import { defineStore } from 'pinia';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { useHeroToolStore } from '@/stores/hero-tool-store';
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
import {
  isViewingOtherWorldLocation,
  navigateToLocation,
  routeToLocation,
} from '@/services/world/location-navigator';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { CONTENT_VERSION, applyCommand } from '@hexoflat/engine';
import type { HexEngineActionContext } from '@hexoflat/engine';
import type { IWorldMapPort } from '@hexoflat/engine/abstraction/abstract-action';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import {
  clearLocationMapIndex,
  newMapId,
  readLocationMapIndex,
  readSavedMap,
  readSavedWorldState,
  removeSavedWorld,
  scheduleWorldSave,
  writeLocationMapIndex,
} from '@/services/persistence/world-storage';
import { tileDirtyTracker } from '@/render/tile-dirty-tracker';
import { getStream, getWorldSeed, reseedWorld } from '@/services/rng/world-rng';
import { worldLoop } from '@/services/world/world-loop';
import {
  initFog as initMapFog,
  revealAroundHero as revealFogAroundHero,
  revealEntryTile as revealMapEntryTile,
  revealTileNextToHero,
} from '@hexoflat/engine/map/fog-service';
import { findTilesMissingSpawners } from '@hexoflat/engine/map/resource-hydration';
import { findFreeHexNearObject } from '@hexoflat/engine/map/free-hex-finder';
import {
  clearLocationRespawn as clearRespawn,
  consumeDueLocationRespawn,
  getLocationRespawnRemainingMs as getRespawnRemainingMs,
  isLocationRespawning as isRespawning,
  scheduleLocationRespawn as scheduleRespawn,
} from '@/services/world/respawn-schedule';
import { useCombatStore, type CombatSnapshot } from '@/stores/combat-store';

type TWorldState = {
  contentVersion: number;
  heroCoordinates: IHexCoordinates | null;
  worldSeed?: string;
} & CombatSnapshot;

function initialLocationKey(): LocationKey {
  return 'camping';
}

const MAP_ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };
let combatAutosaveStop: (() => void) | null = null;

// loadFromStorage() hydrates combat-store as part of reading the blob back.
// Without this guard that hydration would immediately schedule a save of the
// state we are still in the middle of loading.
let isHydratingFromStorage = false;

function withoutCombatAutosave(hydrate: () => void) {
  isHydratingFromStorage = true;
  try {
    hydrate();
  } finally {
    isHydratingFromStorage = false;
  }
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
    woodCollected: 0,
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
        navigate: (locationKey) => navigateToLocation(locationKey),
      };
    },

    rng(label: string) {
      return getStream(label);
    },

    markTileDirty(coordinates: IHexCoordinates) {
      tileDirtyTracker.add(coordinates);
      this.dirtyTick += 1;
    },

    markTilesDirty(coordinatesList: IHexCoordinates[]) {
      if (!coordinatesList.length) return;
      tileDirtyTracker.addMany(coordinatesList);
      this.dirtyTick += 1;
    },

    markAllTilesDirty() {
      if (!this.map) return;
      tileDirtyTracker.addMany(this.map.tiles.map((t) => t.coordinates));
      this.dirtyTick += 1;
    },

    // Called once per render flush by the tiles-layer watcher — hands over
    // the accumulated ids and clears them so the next mutation starts fresh.
    consumeDirtyTileIds(): Set<string> {
      return tileDirtyTracker.consume();
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

      removeSavedWorld(mapId);

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
      scheduleRespawn(locationKey, delayMs);
    },

    clearLocationRespawn(locationKey: LocationKey) {
      clearRespawn(locationKey);
    },

    getLocationRespawnRemainingMs(locationKey: LocationKey) {
      return getRespawnRemainingMs(locationKey);
    },

    isLocationRespawning(locationKey: LocationKey) {
      return isRespawning(locationKey);
    },

    syncLocationRespawn(locationKey: LocationKey) {
      if (!consumeDueLocationRespawn(locationKey)) return;

      const mapId = readLocationMapIndex()[locationKey];
      if (mapId) {
        this.clearStoredLocation(locationKey, mapId);
      }
    },

    hasGraveMarker() {
      if (!this.map) return false;
      const map = this.map as HexMapModel;
      return map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE);
    },

    placeHeroAtCampfire() {
      if (!this.map) return;

      const spawn = findFreeHexNearObject(this.map as HexMapModel, HEXOBJECT_KEYS.FIREPLACE);
      if (!spawn) {
        this.placeHeroAtEntry('camping');
        return;
      }

      useHeroStore().heroCoordinates = spawn;
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
      heroStore.heroCoordinates = null;
      this.currentMapId = null;
      heroStore.setPendingLocation('camping');
      heroStore.reviveAtOneHp();
      events.push('Combat', 'hero was defeated and returned to camping', 'INFO');

      if (isViewingOtherWorldLocation('camping')) {
        await routeToLocation('camping');
        return;
      }

      this.goToLocation('camping');
    },

    enableCombatAutosave() {
      if (combatAutosaveStop) return;
      combatAutosaveStop = useCombatStore().$subscribe(() => {
        if (isHydratingFromStorage) return;
        this.saveToStorage();
      });
    },

    bootstrapWorld() {
      const heroStore = useHeroStore();
      this.enableCombatAutosave();

      const locationKey = heroStore.nav.locationKey;
      const mapId = heroStore.nav.locationMapId ?? undefined;

      this.goToLocation(locationKey, mapId);

      if (this.currentMapId) {
        const remembered = heroStore.nav.positionByMapId[this.currentMapId];
        if (remembered) {
          heroStore.heroCoordinates = { ...remembered };
          this.revealAroundHero();
          this.saveToStorage(this.currentMapId);
        }
      }
    },

    goToLocation(locationKey: LocationKey, preferredMapId?: string) {
      if (locationKey !== this.currentLocationKey && this.isLocationRespawning(locationKey)) {
        useGameEventsStore().push(
          'World',
          `${MapRegistry.get(locationKey).title} is sealed for now.`,
          'INFO',
        );
        return;
      }

      this.leaveCurrentLocation(locationKey);
      this.loadLocationMap(locationKey, preferredMapId);

      if (!this.currentMapId) return;

      this.placeHeroOnArrival(locationKey);
      this.revealAroundHero();
      this.revealEntryTile();
      this.saveToStorage(this.currentMapId);
    },

    leaveCurrentLocation(nextLocationKey: LocationKey) {
      const leavingKey = this.currentLocationKey;
      const respawnDelayMs = MapRegistry.get(leavingKey).respawnAfterClearedMs;

      if (nextLocationKey !== leavingKey && respawnDelayMs && this.hasGraveMarker()) {
        this.scheduleLocationRespawn(leavingKey, respawnDelayMs);
      }

      if (this.currentMapId) {
        const heroCoordinates = useHeroStore().heroCoordinates;
        if (heroCoordinates) {
          useHeroStore().rememberPosition(this.currentMapId, heroCoordinates);
        }
        this.saveToStorage(this.currentMapId);
      }

      this.stopWorldLoop();
    },

    placeHeroOnArrival(locationKey: LocationKey) {
      const heroStore = useHeroStore();
      const remembered = this.currentMapId
        ? heroStore.nav.positionByMapId[this.currentMapId]
        : null;

      if (this.pendingCampingRespawn && locationKey === 'camping') {
        this.placeHeroAtCampfire();
      } else if (remembered) {
        heroStore.heroCoordinates = { ...remembered };
      } else {
        this.placeHeroAtEntry(locationKey);
      }

      this.pendingCampingRespawn = false;
    },

    revealEntryTile() {
      if (!this.map) return;

      const revealed = revealMapEntryTile(this.map as HexMapModel);
      if (revealed) this.markTileDirty(revealed);
    },

    loadLocationMap(locationKey: LocationKey, preferredMapId?: string) {
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
      this.markAllTilesDirty();

      this.startWorldLoop();
      heroStore.setLocation(locationKey, mapId);
    },

    loadFromStorage(mapId: string) {
      const heroStore = useHeroStore();
      const combatStore = useCombatStore();

      const savedMap = readSavedMap(mapId);

      if (savedMap) {
        const loadedAt = Date.now();
        const hydratedMap = HexMapModel.fromJSON(savedMap, loadedAt);
        this.map = hydratedMap;
        this.hydrateResourcesFromConfig();

        const changed = runWorldTick(hydratedMap, loadedAt, this.buildEngineContext());
        if (changed) {
          this.markAllTilesDirty();
          this.saveToStorage(mapId);
        }
      } else {
        this.map = null;
      }

      const raw = readSavedWorldState<TWorldState>(mapId);
      reseedWorld(raw?.worldSeed ?? crypto.randomUUID());

      if (raw) {
        heroStore.heroCoordinates = raw.heroCoordinates ?? null;
        withoutCombatAutosave(() =>
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
          }),
        );
      } else {
        heroStore.heroCoordinates = null;
        this.woodCollected = 0;
        withoutCombatAutosave(() => combatStore.resetToDefaults());
      }

      if (!this.map) return;
      const map = this.map as HexMapModel;

      if (!heroStore.heroCoordinates) {
        heroStore.heroCoordinates =
          findFreeHexNearObject(map, MapRegistry.get(this.currentLocationKey).entryHexobjectKey) ??
          MAP_ORIGIN;

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
      const mapSnapshot = this.map
        ? JSON.stringify({ contentVersion: CONTENT_VERSION, map: this.map })
        : null;
      const state: TWorldState = {
        contentVersion: CONTENT_VERSION,
        heroCoordinates: useHeroStore().heroCoordinates,
        worldSeed: getWorldSeed() ?? undefined,
        ...useCombatStore().toSnapshot(),
      };
      scheduleWorldSave(targetMapId, mapSnapshot, JSON.stringify(state));
    },

    startWorldLoop() {
      worldLoop.start(() => {
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
      });
    },

    stopWorldLoop() {
      worldLoop.stop();
    },

    placeHeroAtEntry(locationKey: LocationKey) {
      if (!this.map) return;

      const def: MapDefinition = MapRegistry.get(locationKey);
      useHeroStore().heroCoordinates =
        findFreeHexNearObject(this.map as HexMapModel, def.entryHexobjectKey, getStream('world')) ??
        MAP_ORIGIN;
    },

    initFog() {
      if (!this.map) return;

      initMapFog(this.map as HexMapModel);
      this.markAllTilesDirty();
    },

    revealAroundHero() {
      const heroCoordinates = useHeroStore().heroCoordinates;
      if (!this.map || !heroCoordinates) return;

      this.markTilesDirty(revealFogAroundHero(this.map as HexMapModel, heroCoordinates));
    },

    revealTile(tileCoordinates: IHexCoordinates) {
      const heroCoordinates = useHeroStore().heroCoordinates;
      if (!this.map || !heroCoordinates) return;

      const revealed = revealTileNextToHero(
        this.map as HexMapModel,
        heroCoordinates,
        tileCoordinates,
      );
      if (!revealed) return;

      this.markTileDirty(revealed);
      this.saveToStorage();
    },

    hydrateResourcesFromConfig() {
      if (!this.map) return;
      const map = this.map as HexMapModel;

      for (const { tile, hexobject } of findTilesMissingSpawners(map)) {
        applyCommand(
          { map, heroes: {} },
          {
            type: 'ADD_RESOURCE_SPAWNER',
            payload: {
              heroId: useHeroStore().hero.id,
              coordinates: tile.coordinates,
              hexobject,
            },
          },
          this.buildEngineContext(),
        );
        this.markTileDirty(tile.coordinates);
      }
    },

    clearAllWorlds() {
      this.stopWorldLoop();

      const index = readLocationMapIndex();
      for (const mapId of Object.values(index)) {
        removeSavedWorld(mapId);
      }

      clearLocationMapIndex();

      this.map = null;
      useHeroStore().heroCoordinates = null;
      this.currentMapId = null;
      this.currentLocationKey = 'camping';
      useCombatStore().endCombat();
    },
  },
});
