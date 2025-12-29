// hero-tool-store.types.ts
import type { IHexCoordinates } from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import { defineStore } from "pinia";
import { coordinateKey, getOddQNeighbors } from "@/utils/hex-utils";

export type HeroToolType = "hand" | "axe";

export interface HeroToolState {
    activeTool: HeroToolType | null;      // що зараз “в руках”
    isDragging: boolean;                   // чи активний режим перетягування
    origin: IHexCoordinates | null;        // координати героя на момент активації
    hover: IHexCoordinates | null;         // над яким тайлом зараз інструмент
}

export const useHeroToolStore = defineStore("heroTool", {
    state: (): HeroToolState & { allowedKeys: string[] } => ({
        activeTool: null,
        isDragging: false,
        origin: null,
        hover: null,
        allowedKeys: [],
    }),

    getters: {
        allowedKeySet: (s) => new Set(s.allowedKeys),
        isActive: (s) => (tool: HeroToolType) => s.activeTool === tool && s.isDragging,
    },

    actions: {
        useTool(tool: HeroToolType, heroCoords: IHexCoordinates) {
            this.activeTool = tool;
            this.isDragging = true;
            this.origin = { ...heroCoords };
            this.hover = null;

            const neighbors = getOddQNeighbors(heroCoords);
            this.allowedKeys = neighbors.map(c => coordinateKey(c));

            if (neighbors.length) {
                this.hover = neighbors[0];
            }
            this.hover = neighbors.length ? neighbors[0] : null;
        },

        updateHover(coords: IHexCoordinates) {
            if (!this.isDragging || !this.origin) return;

            const key = coordinateKey(coords);
            if (!this.allowedKeySet.has(key)) return;

            this.hover = coords;
        },

        stopTool() {
            this.activeTool = null;
            this.isDragging = false;
            this.origin = null;
            this.hover = null;
            this.allowedKeys = [];
        },
    },
});