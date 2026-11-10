import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { forgetAllServerWorlds, cacheServerWorld } from '@/services/player/world-sync';
import type { ServerWorld } from '@hexoflat/engine/world/server-world';
import { reloadWorldCache, type WorldCommandResult } from '@/services/inventory/inventory-sync';
import { installTravelledWorlds, readCachedWorld } from '@/services/world/served-world';
import { takeServerBattleView } from '@/services/battle/battle-server';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
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
import type { HexEngineActionContext } from '@hexoflat/engine';
import type { IWorldMapPort } from '@hexoflat/engine/abstraction/abstract-action';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { tileDirtyTracker } from '@/render/tile-dirty-tracker';
import { getStream, reseedWorld } from '@/services/rng/world-rng';
import { worldLoop } from '@/services/world/world-loop';

import {
  initFog as initMapFog,
  revealAroundHero as revealFogAroundHero,
  revealEntryTile as revealMapEntryTile,
  revealTileNextToHero,
} from '@hexoflat/engine/map/fog-service';
import { hydrateSpawners } from '@/services/world/hydrate-spawners';
import { findEntryHex } from '@/services/world/hero-placement';
import {
  getLocationRespawnRemainingMs as getRespawnRemainingMs,
  isLocationRespawning as isRespawning,
} from '@/services/world/respawn-schedule';
import { useBattleStore } from '@/stores/battle-store';
import { initialLocationKey, MAP_ORIGIN, servedEngagement } from '@/stores/world-map-store-helpers';

import {
  devNextSeed as devNextSeedAction,
  devRebuildFromRecipe as devRebuildFromRecipeAction,
  devRegenerateDungeon as devRegenerateDungeonAction,
  type DevRecipeParams,
} from '@/stores/dev-board-panel-actions';
import {
  applyWorldResultAction,
  serverTickAction,
  serverWorldJsonOfHost,
  stepOnServerAction,
} from '@/stores/server-world-actions';
import { leaveCurrentLocationAction } from '@/stores/leave-location-action';
import { placeHeroOnArrivalAction } from '@/stores/arrival-action';
import { respawnHeroAtCampingAction } from '@/stores/camp-respawn-action';

export const useWorldMapStore = defineStore('world-map-store', {
  state: () => ({
    map: null as HexMapModel | null,
    descriptor: null as BoardDescriptor | null,
    woodCollected: 0,

    currentLocationKey: initialLocationKey(),
    currentMapId: null as string | null,
    worldLoadFailed: false,

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

    getLocationRespawnRemainingMs(locationKey: LocationKey) {
      return getRespawnRemainingMs(locationKey);
    },

    isLocationRespawning(locationKey: LocationKey) {
      return isRespawning(locationKey);
    },

    hasGraveMarker() {
      if (!this.map) return false;
      const map = this.map as HexMapModel;
      return map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE);
    },

    async respawnHeroAtCamping(result: WorldCommandResult) {
      await respawnHeroAtCampingAction(this, result, {
        events: useGameEventsStore(),
        battle: useBattleStore(),
        installTravel: installTravelledWorlds,
        isViewingOtherWorldLocation,
        routeToLocation,
      });
    },

    bootstrapWorld() {
      const heroStore = useHeroStore();

      const locationKey = heroStore.nav.locationKey;

      this.goToLocation(locationKey);

      if (this.currentMapId) {
        const remembered = heroStore.nav.positionByMapId[this.currentMapId];
        if (remembered) {
          heroStore.heroCoordinates = { ...remembered };
          this.revealAroundHero();
          this.cacheServedWorld();
        }
      }
    },

    goToLocation(locationKey: LocationKey) {
      if (locationKey !== this.currentLocationKey && this.isLocationRespawning(locationKey)) {
        useGameEventsStore().push(
          'World',
          `${MapRegistry.get(locationKey).title} is sealed for now.`,
          'INFO',
        );
        return;
      }

      this.leaveCurrentLocation();
      this.loadLocationMap(locationKey);

      if (!this.currentMapId) return;

      this.placeHeroOnArrival(locationKey);
      this.revealAroundHero();
      this.revealEntryTile();
      this.cacheServedWorld();
    },

    leaveCurrentLocation() {
      leaveCurrentLocationAction(this, useHeroStore());
    },

    placeHeroOnArrival(locationKey: LocationKey) {
      placeHeroOnArrivalAction(this, useHeroStore(), locationKey);
    },

    revealEntryTile() {
      if (!this.map) return;

      const revealed = revealMapEntryTile(this.map as HexMapModel);
      if (revealed) this.markTileDirty(revealed);
    },

    loadLocationMap(locationKey: LocationKey) {
      const cached = readCachedWorld(locationKey);
      this.currentLocationKey = locationKey;

      if (!cached) {
        this.stopWorldLoop();
        this.map = null;
        this.descriptor = null;
        this.currentMapId = null;
        this.worldLoadFailed = true;
        return;
      }

      this.worldLoadFailed = false;
      this.currentMapId = cached.mapId;
      this.installServedWorld(cached);
      this.markAllTilesDirty();

      this.startWorldLoop();
      useHeroStore().setLocation(locationKey, cached.mapId);
    },

    async retryWorldLoad() {
      await reloadWorldCache();
      this.goToLocation(this.currentLocationKey);
    },

    serverWorldJson(engagement?: Engagement | null): string | null {
      const held = engagement === undefined ? (useBattleStore().engagement ?? null) : engagement;
      return serverWorldJsonOfHost(this, useHeroStore().heroCoordinates, held);
    },

    stepOnServer(coordinates: IHexCoordinates) {
      return stepOnServerAction(this, useHeroStore(), coordinates);
    },

    applyFreshBoard(created: CreatedBoard) {
      this.map = created.map;
      this.descriptor = created.descriptor;
      this.initFog();
      this.hydrateResourcesFromConfig();
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

    installServedWorld(served: ServerWorld) {
      const heroStore = useHeroStore();

      this.descriptor = served.descriptor;
      this.map = served.map;
      heroStore.heroCoordinates = served.heroCoordinates;
      this.cacheServedWorld(served.engagement);
      this.hydrateResourcesFromConfig();
      reseedWorld(served.worldSeed ?? crypto.randomUUID());
      useBattleStore().restore(
        servedEngagement(served.engagement, this.map as HexMapModel | null),
        takeServerBattleView(),
      );
      if (!heroStore.heroCoordinates) this.placeHeroAtEntry(this.currentLocationKey);
    },

    cacheServedWorld(engagement?: Engagement | null) {
      if (!this.currentMapId) return;
      const json = this.serverWorldJson(engagement);
      if (json) cacheServerWorld(this.currentLocationKey, json);
    },

    applyWorldResult(result: WorldCommandResult) {
      applyWorldResultAction(this, useHeroStore(), result);
    },

    serverTick() {
      return serverTickAction(this, useHeroStore());
    },

    startWorldLoop() {
      worldLoop.start(() => {
        if (!this.map || !this.currentMapId) return;
        void this.serverTick();
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

      forgetAllServerWorlds();

      this.map = null;
      this.descriptor = null;
      useHeroStore().heroCoordinates = null;
      this.currentMapId = null;
      this.worldLoadFailed = false;
      this.currentLocationKey = 'camping';
      useBattleStore().close();
    },
  },
});
