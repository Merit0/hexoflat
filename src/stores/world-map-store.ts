import {defineStore} from 'pinia';
import HexMapModel from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import {HexMapProvider} from '@/a-game-scenes/homeland-scene/providers/hex-map-provider';

const STORAGE_KEY = 'hexoflat';

export const useWorldMapStore = defineStore('world-map-store', {
    state: () => ({
        map: null as HexMapModel | null
    }),

    actions: {
        generateIfEmpty() {
            if (this.map) return;

            console.log('Map generating....');
            this.map = HexMapProvider.getHomeLand();
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
            this.map = HexMapModel.fromJSON(raw);
            console.log('Loaded from storage...')
        },
        clearWorld() {
            console.log('Resetting map...')
            this.map = null;
            localStorage.removeItem(STORAGE_KEY);
        }
    }
});