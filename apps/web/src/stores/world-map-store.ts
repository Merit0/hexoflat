import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { recoverStepPosition } from '@/services/knowledge/step-recovery';
import {
  bindWorldSnapshotter,
  forgetAllServerWorlds,
  forgetServerWorld,
  isServerWorldMode,
  queueWorldPush,
  rememberServerWorld,
} from '@/services/player/world-sync';
import type { ServerWorld } from '@hexoflat/engine/world/server-world';
import { readCachedWorld, serverWorldJson, stepOnServerWorld } from '@/services/world/served-world';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { installCampBook } from '@hexoflat/engine/knowledge/camp-book';
import { defineStore } from 'pinia';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useGatheringStore } from '@/stores/gathering-store';
import {
  LocationKey,
  MapRegistry,
  type CreatedBoard,
} from '@hexoflat/engine/registry/world-map-registry';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';
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
import { hydrateSpawners } from '@/services/world/hydrate-spawners';
import type { ExitSide } from '@hexoflat/engine/boards/exits';
import { findFreeHexNearObject } from '@hexoflat/engine/map/free-hex-finder';
import { findEntryHex } from '@/services/world/hero-placement';
import {
  clearLocationRespawn as clearRespawn,
  consumeDueLocationRespawn,
  getLocationRespawnRemainingMs as getRespawnRemainingMs,
  isLocationRespawning as isRespawning,
  scheduleLocationRespawn as scheduleRespawn,
} from '@/services/world/respawn-schedule';
import { useBattleStore } from '@/stores/battle-store';
import {
  isCurrentlyHydratingFromStorage,
  initialLocationKey,
  MAP_ORIGIN,
  requireWorldSeed,
  runWorldTick,
  readBattleSnapshot,
  withoutBattleAutosave,
  type TWorldState,
} from '@/stores/world-map-store-helpers';

import {
  devNextSeed as devNextSeedAction,
  devRebuildFromRecipe as devRebuildFromRecipeAction,
  devRegenerateDungeon as devRegenerateDungeonAction,
  type DevRecipeParams,
} from '@/stores/dev-board-panel-actions';
import { placeHeroOnArrivalAction } from '@/stores/arrival-action';
import { respawnHeroAtCampingAction } from '@/stores/camp-respawn-action';
import { rebuildStaticIfDrawingChanged as rebuildStaticIfDrawingChangedAction } from '@/services/world/static-board-rebuild';

export { runWorldTick };

bindWorldSnapshotter((force) => useWorldMapStore().queueServerWorld(force));

let battleAutosaveStop: (() => void) | null = null;

export const useWorldMapStore = defineStore('world-map-store', {
  state: () => ({
    map: null as HexMapModel | null,
    descriptor: null as BoardDescriptor | null,
    woodCollected: 0,
    pendingCampingRespawn: false,

    currentLocationKey: initialLocationKey(),
    currentMapId: null as string | null,
    pendingArrivalSide: null as ExitSide | null,

    // Bumped whenever dirtyTileIds gains entries — the render layer watches
    // this (cheap, shallow) instead of deep-watching the tiles array itself.
    dirtyTick: 0,
  }),

  actions: {
    /**
     * Builds the port context @hexoflat/engine's applyCommand needs. The
     * `worldMap` port reads whether a battle is open from battle-store;
     * navigation (isLocationRespawning/goToLocation) stays here — tracked
     * follow-up debt per docs/MIGRATION-PLAN.md Phase 2 (staged scope) to
     * move this off Pinia stores entirely.
     */
    buildEngineContext(): HexEngineActionContext {
      const battleStore = useBattleStore();
      const worldMap: IWorldMapPort = {
        get combatActive() {
          return battleStore.inBattle;
        },
        isLocationRespawning: (locationKey) => this.isLocationRespawning(locationKey),
        getLocationRespawnRemainingMs: (locationKey) =>
          this.getLocationRespawnRemainingMs(locationKey),
        goToLocation: (locationKey) => this.goToLocation(locationKey),
      };

      return {
        heroToolStore: useHeroToolStore(),
        hero: useHeroStore(),
        gathering: useGatheringStore(),
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

    async executeHexAction(
      tile: HexTileModel,
      actionType: EHexActionType,
      toolKey: THeroToolKey,
    ): Promise<{ ok: boolean; message?: string; events: DomainEvent[] }> {
      if (!this.map) return { ok: false, message: 'No active map.', events: [] };

      const events = await useHeroStore().startHexAction({
        type: 'START_HEX_ACTION',
        payload: {
          heroId: useHeroStore().hero.id,
          coordinates: tile.coordinates,
          actionType,
          toolKey,
          now: Date.now(),
        },
      });
      this.markTileDirty(tile.coordinates);

      if (!events) return { ok: false, message: 'Will is unavailable.', events: [] };
      if (events.some((e) => e.type === 'HEX_ACTION_STARTED')) {
        return { ok: true, events };
      }

      const rejected = events.find((e) => e.type === 'HEX_ACTION_START_REJECTED') as
        { type: 'HEX_ACTION_START_REJECTED'; payload: { message: string } } | undefined;

      return { ok: false, message: rejected?.payload.message, events };
    },

    getTileAt(coords: IHexCoordinates): HexTileModel | null {
      return (
        (this.map as HexMapModel | null)?.tiles.find(
          (tile) =>
            tile.coordinates.columnIndex === coords.columnIndex &&
            tile.coordinates.rowIndex === coords.rowIndex,
        ) ?? null
      );
    },

    clearStoredLocation(locationKey: LocationKey, mapId: string) {
      const heroStore = useHeroStore();
      const index = readLocationMapIndex();

      removeSavedWorld(mapId);
      forgetServerWorld(locationKey);

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
      await respawnHeroAtCampingAction(this, {
        hero: useHeroStore(),
        events: useGameEventsStore(),
        battle: useBattleStore(),
        isViewingOtherWorldLocation,
        routeToLocation,
      });
    },

    enableBattleAutosave() {
      if (battleAutosaveStop) return;
      battleAutosaveStop = useBattleStore().$subscribe(() => {
        if (isCurrentlyHydratingFromStorage()) return;
        this.saveToStorage();
      });
    },

    bootstrapWorld() {
      const heroStore = useHeroStore();
      this.enableBattleAutosave();

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
      const leavingDef = MapRegistry.get(leavingKey);
      const respawnDelayMs = leavingDef.respawnAfterClearedMs;
      const isLeavingToElsewhere = nextLocationKey !== leavingKey;

      if (isLeavingToElsewhere && respawnDelayMs && this.hasGraveMarker()) {
        this.scheduleLocationRespawn(leavingKey, respawnDelayMs);
      }

      if (this.currentMapId) {
        const heroCoordinates = useHeroStore().heroCoordinates;
        if (heroCoordinates) {
          useHeroStore().rememberPosition(this.currentMapId, heroCoordinates);
        }

        if (isLeavingToElsewhere && leavingDef.boardKind === 'DUNGEON') {
          this.clearStoredLocation(leavingKey, this.currentMapId);
        } else {
          this.saveToStorage(this.currentMapId);
        }
      }

      this.stopWorldLoop();
    },

    placeHeroOnArrival(locationKey: LocationKey) {
      placeHeroOnArrivalAction(this, useHeroStore(), locationKey);
    },

    revealEntryTile() {
      if (!this.map) return;

      const revealed = revealMapEntryTile(this.map as HexMapModel);
      if (revealed) this.markTileDirty(revealed);
    },

    loadLocationMap(locationKey: LocationKey, preferredMapId?: string) {
      const heroStore = useHeroStore();

      this.syncLocationRespawn(locationKey);

      const cached = readCachedWorld(locationKey);
      const index = readLocationMapIndex();
      const mapId = cached?.mapId ?? preferredMapId ?? index[locationKey] ?? newMapId();

      if (index[locationKey] !== mapId && (cached || !index[locationKey])) {
        index[locationKey] = mapId;
        writeLocationMapIndex(index);
      }

      this.currentLocationKey = locationKey;
      this.currentMapId = mapId;

      this.loadFromStorage(mapId, cached);
      this.rebuildStaticIfDrawingChanged(locationKey, mapId);

      if (!this.map) {
        const def = MapRegistry.get(locationKey);
        this.applyFreshBoard(def.create({ seed: requireWorldSeed() }), mapId);
      }
      if (locationKey === 'camping' && this.map && !cached)
        installCampBook(this.map as HexMapModel, heroStore.heroCoordinates);
      this.markAllTilesDirty();

      this.startWorldLoop();
      heroStore.setLocation(locationKey, mapId);
    },

    serverWorldJson(engagement?: Engagement | null): string | null {
      if (!this.map || !this.currentMapId) return null;
      return serverWorldJson({
        locationKey: this.currentLocationKey,
        mapId: this.currentMapId,
        map: this.map as HexMapModel,
        descriptor: this.descriptor,
        heroCoordinates: useHeroStore().heroCoordinates,
        worldSeed: getWorldSeed(),
        engagement: engagement === undefined ? (useBattleStore().engagement ?? null) : engagement,
      });
    },

    queueServerWorld(force = false) {
      if (!isServerWorldMode() || !this.currentMapId) return;
      const json = this.serverWorldJson();
      if (json) queueWorldPush(this.currentLocationKey, this.currentMapId, json, { force });
    },

    async stepOnServer(coordinates: IHexCoordinates) {
      const from = useHeroStore().heroCoordinates;
      if (!this.map || !this.currentMapId || !from) {
        return { ok: false, code: 'NO_WORLD', ambush: null, changed: [] };
      }
      const at = { locationKey: this.currentLocationKey, mapId: this.currentMapId, from };
      const outcome = await stepOnServerWorld({ ...at, map: this.map as HexMapModel }, coordinates);
      this.markTilesDirty(outcome.changed);
      return outcome;
    },

    rebuildStaticIfDrawingChanged(locationKey: LocationKey, mapId: string) {
      rebuildStaticIfDrawingChangedAction(this, locationKey, mapId, !!this.map, this.descriptor);
    },

    applyFreshBoard(created: CreatedBoard, mapId: string) {
      this.map = created.map;
      this.descriptor = created.descriptor;
      this.initFog();
      this.hydrateResourcesFromConfig();
      this.saveToStorage(mapId);
    },

    setHeroLocation(locationKey: LocationKey, mapId: string) {
      useHeroStore().setLocation(locationKey, mapId);
    },

    devRegenerateDungeon(params: DevRecipeParams = {}) {
      devRegenerateDungeonAction(this, params);
    },

    devNextSeed(params: DevRecipeParams = {}) {
      devNextSeedAction(this, params);
    },

    devRebuildFromRecipe(recipe: BoardRecipeInput, params: DevRecipeParams = {}) {
      devRebuildFromRecipeAction(this, recipe, params);
    },

    loadFromStorage(mapId: string, served: ServerWorld | null = null) {
      const heroStore = useHeroStore();
      const battleStore = useBattleStore();

      const savedMap = served ? null : readSavedMap(mapId);
      const raw = readSavedWorldState<TWorldState>(mapId);
      this.descriptor = served ? served.descriptor : (raw?.descriptor ?? null);

      if (served) {
        this.map = served.map;
        heroStore.heroCoordinates = served.heroCoordinates;
        rememberServerWorld(
          this.currentLocationKey,
          mapId,
          this.serverWorldJson(served.engagement) ?? '',
        );
      }
      if (savedMap || served) {
        const loadedAt = Date.now();
        if (savedMap) this.map = HexMapModel.fromJSON(savedMap, loadedAt);
        const hydratedMap = this.map as HexMapModel;
        this.hydrateResourcesFromConfig();

        const changed = runWorldTick(
          hydratedMap,
          loadedAt,
          this.buildEngineContext(),
          useHeroStore().hero.id,
        );
        if (changed) this.markAllTilesDirty();
      } else {
        this.map = null;
      }

      reseedWorld(served?.worldSeed ?? raw?.worldSeed ?? crypto.randomUUID());

      if (served || raw) {
        if (!served && raw) {
          heroStore.heroCoordinates = raw.heroCoordinates ?? null;
          const recovered = recoverStepPosition(heroStore.knowledge, mapId, raw.knowledgeRevision);
          if (recovered) heroStore.rememberPosition(mapId, (heroStore.heroCoordinates = recovered));
        }
        withoutBattleAutosave(() =>
          battleStore.restore(readBattleSnapshot(raw?.battle, this.map as HexMapModel | null)),
        );
      } else {
        heroStore.heroCoordinates = null;
        this.woodCollected = 0;
        withoutBattleAutosave(() => battleStore.close());
      }

      if (!this.map) return;

      if (!heroStore.heroCoordinates) {
        this.placeHeroAtEntry(this.currentLocationKey);
      }
      if (!served) this.revealAroundHero();
      this.saveToStorage(mapId);
    },

    saveToStorage(mapId?: string, options: { synced?: boolean } = {}) {
      const targetMapId = mapId ?? this.currentMapId;
      if (!targetMapId) return;
      const serverMode = isServerWorldMode();
      const mapSnapshot =
        this.map && !serverMode
          ? JSON.stringify({ contentVersion: CONTENT_VERSION, map: this.map })
          : null;
      const state: TWorldState = {
        contentVersion: CONTENT_VERSION,
        heroCoordinates: useHeroStore().heroCoordinates,
        knowledgeRevision: useHeroStore().knowledge?.revision,
        worldSeed: getWorldSeed() ?? undefined,
        descriptor: this.descriptor,
        battle: useBattleStore().snapshot(),
      };
      scheduleWorldSave(targetMapId, mapSnapshot, JSON.stringify(state));
      if (!serverMode || targetMapId !== this.currentMapId) return;
      if (options.synced) {
        const json = this.serverWorldJson();
        if (json) rememberServerWorld(this.currentLocationKey, targetMapId, json);
      } else {
        this.queueServerWorld();
      }
    },

    startWorldLoop() {
      worldLoop.start(() => {
        if (!this.map || !this.currentMapId) return;
        const changed = runWorldTick(
          this.map as HexMapModel,
          Date.now(),
          this.buildEngineContext(),
          useHeroStore().hero.id,
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

      useHeroStore().heroCoordinates =
        findEntryHex(this.map as HexMapModel, locationKey, getStream('world')) ?? MAP_ORIGIN;
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
      hydrateSpawners(
        this.map as HexMapModel,
        useHeroStore().hero.id,
        this.buildEngineContext(),
        (coordinates) => this.markTileDirty(coordinates),
      );
    },

    clearAllWorlds() {
      this.stopWorldLoop();

      const index = readLocationMapIndex();
      for (const mapId of Object.values(index)) {
        removeSavedWorld(mapId);
      }

      clearLocationMapIndex();
      forgetAllServerWorlds();

      this.map = null;
      this.descriptor = null;
      useHeroStore().heroCoordinates = null;
      this.currentMapId = null;
      this.currentLocationKey = 'camping';
      useBattleStore().close();
    },
  },
});
