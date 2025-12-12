import {defineStore} from 'pinia';
import HexMapModel from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import {HexMapProvider} from '@/a-game-scenes/homeland-scene/providers/hex-map-provider';
import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

const STORAGE_KEY = 'hexoflat';

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

            console.log('Map generating....');
            this.map = HexMapProvider.getHomeLand();
            this.initHeroPosition();
            this.saveToStorage();
        },

        initHeroPosition() {
            if (!this.map) return;

            const campTile: HexTileModel = this.map.tiles.find(
                (t: HexTileModel) => t.tileType === 'home'
            );

            this.heroCoordinates = campTile
                ? { ...campTile.coordinates }
                : { columnIndex: 0, rowIndex: 0 };
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
            this.map = HexMapModel.fromJSON(raw);
            console.log('Loaded from storage...')
        },
        clearWorld() {
            console.log('Resetting map...')
            this.map = null;
            this.heroCoordinates = null;
            this.woodCollected = 0;
            localStorage.removeItem(STORAGE_KEY);
        }
    }
});