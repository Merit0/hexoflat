import {defineStore} from 'pinia';
import HexMapModel from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import {HexMapProvider} from '@/a-game-scenes/homeland-scene/providers/hex-map-provider';
import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {coordinateKey, getOddQNeighbors} from "@/utils/hex-utils";
import {useHeroToolStore} from "@/stores/hero-tool-store";

type TWorldState = {
    heroCoordinates: IHexCoordinates | null;
    woodCollected: number;
};


const STORAGE_KEY = 'hexoflat:map';
const STORAGE_KEY_STATE = "hexoflat:worldState";

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

            this.makeCampSafeZone();

            // якщо героя ще нема — ставимо і зберігаємо
            if (!this.heroCoordinates) {
                this.initHeroNearCampRandom(); // або deterministic
            }

            this.initFog();
            this.revealAroundHero();
            // this.initFogAndReveal();
            this.saveToStorage();
        },

        initHeroNearCampRandom() {
            if (!this.map) return;

            const campTile: HexTileModel = this.map.tiles.find((t: HexTileModel) => t.tileType === "home");
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

            const campTile: HexTileModel = this.map.tiles.find((t: HexTileModel) => t.tileType === "home");
            if (!campTile) return;

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const neighbors = getOddQNeighbors(campTile.coordinates);

            for (const c of neighbors) {
                const tile = byKey.get(coordinateKey(c));
                if (!tile) continue;

                // safe-zone завжди порожній, але home не чіпаємо
                if (tile.tileType === "home") continue;

                // У POC safe-zone перемагає все, щоб було "кругом пусто"
                tile.tileType = "empty";
                tile.tileKey = null;
                tile.description = "Nothing around";
                tile.imagePath = "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png";
            }
        },

        revealTile(tileCoordinates: IHexCoordinates) {
            if (!this.map || !this.heroCoordinates) return;

            // 1) знайдемо тайл по координатах
            const tile = this.map.tiles.find(
                (t: HexTileModel) => t.coordinates.columnIndex === tileCoordinates.columnIndex
                    && t.coordinates.rowIndex === tileCoordinates.rowIndex
            );
            if (!tile) return;

            // 2) якщо вже відкритий — нічого
            if (tile.isRevealed) return;

            // 3) не відкриваємо тайл героя (він і так відкритий)
            const isHeroTile =
                tile.coordinates.columnIndex === this.heroCoordinates.columnIndex &&
                tile.coordinates.rowIndex === this.heroCoordinates.rowIndex;

            if (isHeroTile) return;

            // 4) перевірка: чи це сусід героя (радіус 1)
            const neighbors = getOddQNeighbors(this.heroCoordinates);
            const isNeighbor = neighbors.some(n =>
                n.columnIndex === tile.coordinates.columnIndex &&
                n.rowIndex === tile.coordinates.rowIndex
            );

            if (!isNeighbor) return;

            // 5) відкриваємо
            tile.isRevealed = true;

            // 6) якщо тайл заданий конфігом (home/enemy/...) — не міняємо тип
            //    “звичайний” тайл — це коли tileType empty (або твій дефолт)
            const isConfigTile = tile.tileType !== "empty";

            if (isConfigTile) {
                this.saveToStorage();
                return;
            }

            // 7) RNG: empty / tree
            const roll = Math.random();

            if (roll < 0.3) {
                tile.tileType = "tree";
                tile.description = "A tree. Could be chopped.";
                tile.imagePath = "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/tree-tile-image.png";
            } else {
                tile.tileType = "empty";
                tile.description = "Nothing around";
                tile.imagePath = "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png";
            }

            this.saveToStorage();
        },

        moveHeroTo(target: IHexCoordinates): boolean {
            const heroToolStore = useHeroToolStore();

            if (!this.map || !this.heroCoordinates) return;

            if (heroToolStore.isDragging) return false;

            // тільки на сусіда
            const neighbors = getOddQNeighbors(this.heroCoordinates);
            const isNeighbor = neighbors.some(n =>
                n.columnIndex === target.columnIndex && n.rowIndex === target.rowIndex
            );
            if (!isNeighbor) return;

            // знаходимо тайл
            const tile: HexTileModel = this.map.tiles.find((t: HexTileModel) =>
                t.coordinates.columnIndex === target.columnIndex &&
                t.coordinates.rowIndex === target.rowIndex
            );
            if (!tile) return;

            // рухаємося лише на відкритий тайл (POC правило)
            if (!tile.isRevealed) return;

            // POC блокери (потім замінимо на interaction rules)
            if (tile.tileType === "enemy") return;

            // (опціонально) не заходимо на home
            if (tile.tileType === "home") return;

            // рух
            this.heroCoordinates = {...target};

            // відкриваємо нову зону
            this.revealAroundHero();

            // зберігаємо
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

        loadFromStorage() {
            const savedMap = localStorage.getItem(STORAGE_KEY);
            if (savedMap) {
                const raw = JSON.parse(savedMap);
                this.map = HexMapModel.fromJSON(raw);
            }

            const savedState = localStorage.getItem(STORAGE_KEY_STATE);
            if (savedState) {
                const rawState = JSON.parse(savedState) as Partial<TWorldState>;
                this.heroCoordinates = rawState.heroCoordinates ?? null;
                this.woodCollected = rawState.woodCollected ?? 0;
            }

            // якщо карти нема — просто виходимо (а генерацію робить generateIfEmpty/boot)
            if (!this.map) {
                console.log("Loaded state, but map missing");
                return;
            }

            // якщо героя нема — ініціалізуємо 1 раз
            if (!this.heroCoordinates) {
                this.initHeroNearCampRandom();
                this.revealAroundHero();
                this.saveToStorage();
                console.log("Loaded map, hero was missing -> initialized");
                return;
            }

            // ✅ якщо герой є — просто гарантуємо, що зона навколо нього відкрита
            this.revealAroundHero();

            // ❗ тут НЕ треба saveToStorage() постійно
            console.log("Loaded from storage...");
        },

        clearWorld() {
            console.log("Resetting map...");
            this.map = null;
            this.heroCoordinates = null;
            this.woodCollected = 0;

            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY_STATE);
        }

    }
});