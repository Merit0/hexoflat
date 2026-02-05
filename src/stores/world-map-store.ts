import { defineStore } from "pinia";
import HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { coordinateKey, getOddQNeighbors } from "@/utils/hex-utils";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { EHexCollision } from "@/abstraction/hexobject-abstraction";
import { WorldTickFeature } from "@/features/resource-features/world-tick-feature";
import { AddResourceSpawnerFeature } from "@/features/resource-features/add-resource-spawner-feature";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { CoinsGenerator } from "@/generators/coins-generator";
import { useHeroStore } from "@/stores/hero-store";
import { useGameEventsStore } from "@/stores/game-events-store";
import {LocationKey, MapDefinition, MapRegistry} from "@/registry/world-map-registry";

type TWorldState = {
    heroCoordinates: IHexCoordinates | null;
};

const STORAGE_MAP_PREFIX = "hexoflat:world:map:v1:";
const STORAGE_STATE_PREFIX = "hexoflat:world:state:v1:";
const STORAGE_INDEX = "hexoflat:world:index:v1";

function newId(): string {
    return crypto.randomUUID();
}

function readIndex(): Partial<Record<LocationKey, string>> {
    const raw = localStorage.getItem(STORAGE_INDEX);
    return raw ? JSON.parse(raw) : {};
}

function writeIndex(index: Partial<Record<LocationKey, string>>) {
    localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
}

let worldTimer: number | null = null;

export const useWorldMapStore = defineStore("world-map-store", {
    state: () => ({
        map: null as HexMapModel | null,
        heroCoordinates: null as IHexCoordinates | null,
        woodCollected: 0,

        currentLocationKey: "camping" as LocationKey,
        currentMapId: null as string | null,
    }),

    actions: {
        bootstrapWorld() {
            const heroStore = useHeroStore();

            const locationKey = heroStore.nav.locationKey;
            const mapId = heroStore.nav.locationMapId ?? undefined;

            this.openLocation(locationKey, mapId);

            if (this.currentMapId) {
                const remembered = heroStore.nav.positionByMapId[this.currentMapId];
                if (remembered) {
                    this.heroCoordinates = { ...remembered };
                    this.revealAroundHero();
                    this.saveToStorage(this.currentMapId);
                }
            }
        },

        // ======================================================
        // NAVIGATION
        // ======================================================

        goToLocation(locationKey: LocationKey, opts?: { spawn?: "remember" | "default" }) {
            const heroStore = useHeroStore();

            if (this.currentMapId && this.heroCoordinates) {
                heroStore.rememberPosition(this.currentMapId, this.heroCoordinates);
            }
            if (this.currentMapId) this.saveToStorage(this.currentMapId);

            this.stopWorldLoop();

            this.openLocation(locationKey);

            // ✅ restore position only if spawn !== "default"
            if (this.currentMapId) {
                const shouldUseRemembered = opts?.spawn !== "default";
                const remembered = heroStore.nav.positionByMapId[this.currentMapId];

                if (remembered && shouldUseRemembered) {
                    this.heroCoordinates = { ...remembered };
                } else {
                    this.placeHeroAtEntry(locationKey);
                }

                this.revealAroundHero();
                this.saveToStorage(this.currentMapId);
            }
        },

        openLocation(locationKey: LocationKey, preferredMapId?: string) {
            const heroStore = useHeroStore();

            const index = readIndex();
            const mapId = preferredMapId ?? index[locationKey] ?? newId();

            if (!index[locationKey]) {
                index[locationKey] = mapId;
                writeIndex(index);
            }

            this.currentLocationKey = locationKey;
            this.currentMapId = mapId;

            // 1) load existing if possible
            this.loadFromStorage(mapId);

            // 2) if no save -> generate new
            if (!this.map) {
                const def = MapRegistry.get(locationKey);
                this.map = def.create();

                this.initFog();
                this.initCoins();
                this.placeHeroAtEntry(locationKey);
                this.revealAroundHero();
                this.saveToStorage(mapId);
            } else {
                this.revealAroundHero();
            }

            this.startWorldLoop();
            heroStore.setLocation(locationKey, mapId);
        },

        // ======================================================
        // MAP LIFECYCLE
        // ======================================================

        loadFromStorage(mapId: string) {
            const savedMap = localStorage.getItem(STORAGE_MAP_PREFIX + mapId);

            if (savedMap) {
                this.map = HexMapModel.fromJSON(JSON.parse(savedMap));
                this.hydrateResourcesFromConfig();

                const changed = new WorldTickFeature(this.map).tick(Date.now());
                if (changed) this.saveToStorage(mapId);
            } else {
                this.map = null;
            }

            const savedState = localStorage.getItem(STORAGE_STATE_PREFIX + mapId);
            if (savedState) {
                const raw = JSON.parse(savedState) as Partial<TWorldState>;
                this.heroCoordinates = raw.heroCoordinates ?? null;
            } else {
                this.heroCoordinates = null;
                this.woodCollected = 0;
            }

            if (!this.map) return;

            // ✅ Якщо координат нема — ставимо героя біля ENTRY цієї мапи
            if (!this.heroCoordinates) {
                const def = MapRegistry.get(this.currentLocationKey);

                const entryTile = this.map.tiles.find(
                    (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey
                );

                if (entryTile) {
                    const byKey = new Map<string, HexTileModel>();
                    for (const t of this.map.tiles) {
                        byKey.set(coordinateKey(t.coordinates), t);
                    }

                    const neighbor = getOddQNeighbors(entryTile.coordinates)
                        .map(c => byKey.get(coordinateKey(c)))
                        .find(t => t && t.hexobject?.collision !== EHexCollision.SOLID);

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
        },

        saveToStorage(mapId = this.currentMapId) {
            if (!mapId) return;

            if (this.map) {
                localStorage.setItem(
                    STORAGE_MAP_PREFIX + mapId,
                    JSON.stringify(this.map)
                );
            }

            const state: TWorldState = {
                heroCoordinates: this.heroCoordinates,
            };

            localStorage.setItem(
                STORAGE_STATE_PREFIX + mapId,
                JSON.stringify(state)
            );
        },

        // ======================================================
        // WORLD LOOP
        // ======================================================

        startWorldLoop() {
            if (worldTimer) return;

            worldTimer = window.setInterval(() => {
                if (!this.map || !this.currentMapId) return;
                const changed = new WorldTickFeature(this.map).tick(Date.now());
                if (changed) this.saveToStorage(this.currentMapId);
            }, 250);
        },

        stopWorldLoop() {
            if (worldTimer) {
                clearInterval(worldTimer);
                worldTimer = null;
            }
        },

        // ======================================================
        // HERO MOVEMENT & VISIBILITY
        // ======================================================

        placeHeroAtEntry(locationKey: LocationKey) {
            if (!this.map) return;

            const def: MapDefinition = MapRegistry.get(locationKey);
            const entryTile = this.map.tiles.find(
                (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey
            );

            if (!entryTile) {
                this.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
                return;
            }

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const neighbors = getOddQNeighbors(entryTile.coordinates)
                .map(c => byKey.get(coordinateKey(c)))
                .filter((t): t is HexTileModel => !!t)
                .filter(t => t.hexobject?.collision !== EHexCollision.SOLID);

            const chosen = neighbors.length
                ? neighbors[Math.floor(Math.random() * neighbors.length)]
                : entryTile;

            this.heroCoordinates = { ...chosen.coordinates };
        },

        initFog() {
            if (!this.map) return;
            for (const t of this.map.tiles) t.isRevealed = false;
        },

        revealAroundHero() {
            if (!this.map || !this.heroCoordinates) return;

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) byKey.set(coordinateKey(t.coordinates), t);

            const coords = [
                this.heroCoordinates,
                ...getOddQNeighbors(this.heroCoordinates),
            ];

            for (const c of coords) {
                const tile = byKey.get(coordinateKey(c));
                if (tile) tile.isRevealed = true;
            }
        },

        moveHeroTo(target: IHexCoordinates): boolean {
            const heroToolStore = useHeroToolStore();
            const heroStore = useHeroStore();
            const events = useGameEventsStore();

            if (!this.map || !this.heroCoordinates) return false;
            if (heroToolStore.isDragging) return false;

            const neighbors = getOddQNeighbors(this.heroCoordinates);
            if (!neighbors.some(n =>
                n.columnIndex === target.columnIndex &&
                n.rowIndex === target.rowIndex
            )) return false;

            const tile: HexTileModel = this.map.tiles.find(
                (t: HexTileModel) =>
                    t.coordinates.columnIndex === target.columnIndex &&
                    t.coordinates.rowIndex === target.rowIndex
            );
            if (!tile || !tile.isRevealed) return false;

            if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
            if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING_ENTRANCE) return false;

            this.heroCoordinates = { ...target };
            heroStore.hero?.makeStep();

            events.push(
                heroStore.hero?.name ?? "Hero",
                `moved to [${target.columnIndex}, ${target.rowIndex}]`,
                "INFO"
            );

            this.revealAroundHero();
            this.saveToStorage();
            heroStore.rememberPosition(this.currentMapId!, this.heroCoordinates);

            return true;
        },

        revealTile(tileCoordinates: IHexCoordinates) {
            if (!this.map || !this.heroCoordinates) return;

            const tile = this.map.tiles.find(
                (t: HexTileModel) => t.coordinates.columnIndex === tileCoordinates.columnIndex
                    && t.coordinates.rowIndex === tileCoordinates.rowIndex
            );
            if (!tile) return;

            if (tile.isRevealed) return;

            const isHeroTile =
                tile.coordinates.columnIndex === this.heroCoordinates.columnIndex &&
                tile.coordinates.rowIndex === this.heroCoordinates.rowIndex;

            if (isHeroTile) return;

            const neighbors = getOddQNeighbors(this.heroCoordinates);
            const isNeighbor = neighbors.some(n =>
                n.columnIndex === tile.coordinates.columnIndex &&
                n.rowIndex === tile.coordinates.rowIndex
            );

            if (!isNeighbor) return;

            tile.isRevealed = true;

            const isConfigTile = tile.tileType !== "empty";

            if (isConfigTile) {
                this.saveToStorage();
                return;
            }

            this.saveToStorage();
        },

        // ======================================================
        // RESOURCES
        // ======================================================

        hydrateResourcesFromConfig() {
            if (!this.map?.config?.length) return;

            const tileByKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                tileByKey.set(`${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`, t);
            }

            for (const placement of this.map.config) {
                for (const c of placement.coordinates) {
                    const tile = tileByKey.get(`${c.columnIndex}:${c.rowIndex}`);
                    if (tile && !tile.resourceSpawner) {
                        new AddResourceSpawnerFeature(tile, placement.hexobject!).add();
                    }
                }
            }
        },

        initCoins() {
            if (!this.map) return;

            new CoinsGenerator(this.map, {
                chance: 0.05,
                maxCoinsOnMap: 15,
                minAmount: 1,
                maxAmount: 5,
                skipSpawnerTiles: true,
            }).generate();
        },

        // ======================================================
        // RESET
        // ======================================================

        clearAllWorlds() {
            this.stopWorldLoop();

            const index = readIndex();
            for (const mapId of Object.values(index)) {
                localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
                localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
            }

            localStorage.removeItem(STORAGE_INDEX);

            this.map = null;
            this.heroCoordinates = null;
            this.currentMapId = null;
            this.currentLocationKey = "camping";
        },
    },
});