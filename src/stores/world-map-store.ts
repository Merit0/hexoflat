import {defineStore} from 'pinia';
import {HexMapModel} from '@/a-game-scenes/silesia-world-scene/models/hex-map-model';
import {HexTileModel} from '@/a-game-scenes/silesia-world-scene/models/hex-tile-model';
import {HexMapProvider} from "@/a-game-scenes/silesia-world-scene/providers/hex-map-provider";

const STORAGE_KEY = 'monstrum_world_map';

export const useWorldMapStore = defineStore('world-map-store', {
    state: () => ({
        map: null as HexMapModel | null
    }),

    actions: {
        generateIfEmpty() {
            if (this.map) return;

            this.map = HexMapProvider.getSilesia();
            this.saveToStorage();
        },

        saveToStorage() {
            if (this.map) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.map));
            }
        },

        loadFromStorage() {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const raw = JSON.parse(saved);
            const map = new HexMapModel(raw.name, raw.width, raw.height, raw.regions);
            map.tiles = raw.tiles.map((t: HexTileModel) => {
                const tile = new HexTileModel(t.q, t.r);
                tile.isBlocked = t.isBlocked;
                tile.terrain = t.terrain;
                tile.imagePath = t.imagePath;
                tile.regionKey = t.regionKey;
                tile.name = t.name;
                tile.requiredMyriads = t.requiredMyriads;
                return tile;
            });
            this.map = map;
        }
    }
});