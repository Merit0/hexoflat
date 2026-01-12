import {defineStore} from 'pinia';
import HexMapModel from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import {HexMapProvider} from '@/a-game-scenes/homeland-scene/providers/hex-map-provider';
import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {coordinateKey, getOddQNeighbors} from "@/utils/hex-utils";
import {useHeroToolStore} from "@/stores/hero-tool-store";
import {EHexCollision} from "@/abstraction/hexobject-abstraction";
import {WorldTickFeature} from "@/features/resource-features/world-tick-feature";
import {AddResourceSpawnerFeature} from "@/features/resource-features/add-resource-spawner-feature";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

type TWorldState = {
    heroCoordinates: IHexCoordinates | null;
    woodCollected: number;
};


const STORAGE_KEY = 'hexoflat:map';
const STORAGE_KEY_STATE = "hexoflat:worldState";

let worldTimer: number | null = null;

export const useWorldMapStore = defineStore('world-map-store', {
    state: () => ({
        map: null as HexMapModel | null,
        heroCoordinates: null as IHexCoordinates | null,
        heroRevealRadius: 1,
        woodCollected: 0,
    }),

    actions: {
        generateIfEmpty() {
            if (this.map) return;

            console.log("Map generating....");
            this.map = HexMapProvider.getHomeLand();
            this.startWorldLoop();

            this.makeCampSafeZone();

            if (!this.heroCoordinates) {
                this.initHeroNearCampRandom();
            }

            this.initFog();
            this.revealAroundHero();
            this.saveToStorage();
        },

        initHeroNearCampRandom() {
            if (!this.map) return;

            const campTile: HexTileModel = this.map.tiles.find((t: HexTileModel) => t.hexobject?.hexobjectKey === "camping");
            if (!campTile) {
                this.heroCoordinates = {columnIndex: 0, rowIndex: 0};
                return;
            }

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const neighbors = getOddQNeighbors(campTile.coordinates);

            const neighborTiles = neighbors
                .map(c => byKey.get(coordinateKey(c)))
                .filter((t): t is HexTileModel => !!t);

            if (!neighborTiles.length) {
                this.heroCoordinates = {...campTile.coordinates};
                return;
            }

            const randomIndex = Math.floor(Math.random() * neighborTiles.length);
            this.heroCoordinates = {...neighborTiles[randomIndex].coordinates};
        },

        initFog() {
            if (!this.map) return;

            for (const t of this.map.tiles) {
                t.isRevealed = false;
            }
        },

        revealAroundHero() {
            if (!this.map || !this.heroCoordinates) return;

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const coordsToReveal: IHexCoordinates[] = [
                this.heroCoordinates,
                ...getOddQNeighbors(this.heroCoordinates),
            ];

            for (const c of coordsToReveal) {
                const tile = byKey.get(coordinateKey(c));
                if (tile) tile.isRevealed = true;
            }
        },

        makeCampSafeZone() {
            if (!this.map) return;

            const campTile: HexTileModel = this.map.tiles.find((t: HexTileModel) => t.hexobject?.hexobjectKey === "camping");
            if (!campTile) return;

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const neighbors = getOddQNeighbors(campTile.coordinates);

            for (const c of neighbors) {
                const tile = byKey.get(coordinateKey(c));
                if (!tile) continue;

                if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING) continue;

                tile.tileType = "empty";
                tile.tileKey = null;
            }
        },

        startWorldLoop() {
            if (worldTimer) return;

            worldTimer = window.setInterval(() => {
                if (!this.map) return;

                const changed = new WorldTickFeature(this.map).tick(Date.now());
                if (changed) {
                    this.saveToStorage();
                }
            }, 250);
        },

        stopWorldLoop() {
            if (worldTimer) {
                window.clearInterval(worldTimer);
                worldTimer = null;
            }
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

        moveHeroTo(target: IHexCoordinates): boolean {
            const heroToolStore = useHeroToolStore();

            if (!this.map || !this.heroCoordinates) return false;
            if (heroToolStore.isDragging) return false;

            const neighbors = getOddQNeighbors(this.heroCoordinates);
            const isNeighbor = neighbors.some(n =>
                n.columnIndex === target.columnIndex && n.rowIndex === target.rowIndex
            );
            if (!isNeighbor) return false;

            const tile: HexTileModel = this.map.tiles.find((t: HexTileModel) =>
                t.coordinates.columnIndex === target.columnIndex &&
                t.coordinates.rowIndex === target.rowIndex
            );

            if (!tile) return false;
            if (!tile.isRevealed) return false;
            if (tile.hexobject) {
                if (tile.hexobject.collision === EHexCollision.SOLID) return false;
                if (tile.hexobject.hexobjectKey === HEXOBJECT_KEYS.CAMPING) return false;
            }

            this.heroCoordinates = {...target};
            this.revealAroundHero();
            this.saveToStorage();

            return true;
        },

        saveToStorage() {
            if (this.map) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.map));
            }
            const state: TWorldState = {
                heroCoordinates: this.heroCoordinates,
                woodCollected: this.woodCollected ?? 0,
            };

            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
        },

        hydrateResourcesFromConfig() {
            if (!this.map?.config?.length) return;

            const tileByKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                tileByKey.set(`${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`, t);
            }

            for (const placement of this.map.config) {
                if (!placement.hexobject) continue;

                for (const c of placement.coordinates) {
                    const tile = tileByKey.get(`${c.columnIndex}:${c.rowIndex}`);
                    if (!tile) continue;

                    // ✅ merge-only: лише додаємо спавнер, якщо його ще нема
                    if (!tile.resourceSpawner) {
                        new AddResourceSpawnerFeature(tile, placement.hexobject).add();
                    }
                }
            }
        },

        loadFromStorage() {
            const savedMap = localStorage.getItem(STORAGE_KEY);
            if (savedMap) {
                const raw = JSON.parse(savedMap);
                this.map = HexMapModel.fromJSON(raw);

                // ⚠️ ВАЖЛИВО: hydrateResourcesFromConfig має бути "merge", не overwrite.
                // Якщо вона зараз відновлює об'єкти насильно — перенеси її нижче і зроби safe (див. примітку).
                this.hydrateResourcesFromConfig();

                // ✅ reconcile world state always
                const changed = new WorldTickFeature(this.map).tick(Date.now());

                // ✅ save only if rehydrate/tick changed something
                if ((this.map as any).__rehydrateChanged || changed) {
                    this.saveToStorage();
                    // можна очистити флаг, щоб не дратував
                    (this.map as any).__rehydrateChanged = false;
                }
            }

            const savedState = localStorage.getItem(STORAGE_KEY_STATE);
            if (savedState) {
                const rawState = JSON.parse(savedState) as Partial<TWorldState>;
                this.heroCoordinates = rawState.heroCoordinates ?? null;
                this.woodCollected = rawState.woodCollected ?? 0;
            }

            if (!this.map) {
                console.log("Loaded state, but map missing");
                return;
            }

            if (!this.heroCoordinates) {
                this.initHeroNearCampRandom();
                this.revealAroundHero();
                this.saveToStorage();
                console.log("Loaded map, hero was missing -> initialized");
            } else {
                this.revealAroundHero();
            }

            this.startWorldLoop();

            console.log("Loaded from storage...");
        },

        clearWorld() {
            console.log("Resetting map...");
            this.map = null;
            this.stopWorldLoop();
            this.heroCoordinates = null;
            this.woodCollected = 0;

            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY_STATE);
        }
    }
});