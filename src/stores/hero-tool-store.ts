import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { defineStore } from "pinia";
import { coordinateKey, getOddQNeighbors } from "@/utils/hex-utils";
import type { ResolvedAction } from "@/game-resolvers/interactions-resolver";
import {HeroToolType} from "@/enums/hero-tool-type";

export interface HeroToolState {
    activeTool: HeroToolType | null;
    isDragging: boolean;
    origin: IHexCoordinates | null;
    hover: IHexCoordinates | null;
    availableActions: ResolvedAction[] | [];
    hintLabel: string | null;
    durability: number;
    durabilityMax: number;
    isLocked: boolean;
    lockedUntil: number | null;
    lockedToolCoordinates: IHexCoordinates | null;

    treesCut: number; //todo:
}

export const useHeroToolStore = defineStore("heroTool", {
    state: (): HeroToolState & { allowedKeys: string[] } => ({
        activeTool: "hand" as HeroToolType,
        isDragging: false,
        origin: null,
        hover: null,
        allowedKeys: [],
        availableActions: [] as ResolvedAction[],
        hintLabel: null as string | null,
        isLocked: false,
        lockedUntil: null,
        lockedToolCoordinates: null,

        // ✅ defaults (hand ignores these anyway)
        durability: 100,
        durabilityMax: 100,

        treesCut: 0,
    }),

    getters: {
        allowedKeySet: (s) => new Set(s.allowedKeys),
        isActive: (s) => (tool: HeroToolType) => s.activeTool === tool && s.isDragging,
    },

    actions: {
        useTool(tool: HeroToolType, heroCoords: IHexCoordinates) {
            if (this.isLocked) return;
            this.activeTool = tool;
            this.isDragging = true;
            this.origin = { ...heroCoords };
            this.hover = null;

            if (tool === HeroToolType.HAND) {
            } else if (this.durabilityMax <= 0) {
                this.durabilityMax = 100;
                this.durability = Math.min(this.durability, this.durabilityMax);
            }

            const neighbors = getOddQNeighbors(heroCoords);
            this.allowedKeys = neighbors.map((c) => coordinateKey(c));
            this.hover = neighbors.length ? neighbors[0] : null;
        },

        lockTool(coord: IHexCoordinates, untilMs: number) {
            this.isLocked = true;
            this.lockedUntil = untilMs;
            this.lockedToolCoordinates = { ...coord };
            this.hover = { ...coord };
        },

        unlockTool() {
            this.isLocked = false;
            this.lockedUntil = null;
            this.lockedToolCoordinates = null;
        },

        updateHover(coords: IHexCoordinates) {
            if (!this.isDragging || !this.origin) return;
            if (this.isLocked) return;

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
            this.clearResolvedActions();
        },

        setResolvedActions(actions: ResolvedAction[]) {
            this.availableActions = actions;
            this.hintLabel = actions.length ? actions[0].label : null;
        },

        clearResolvedActions() {
            this.availableActions = [];
            this.hintLabel = null;
        },

        /**
         * Consume durability as percent of durabilityMax.
         * Example: consumeDurability(0.1) => -10% of max (min -1)
         * Returns false if tool is broken (durability hits 0).
         */
        consumeDurability(percent: number): boolean {
            // no tool / hand => no durability system
            if (!this.activeTool || this.activeTool === "hand") return true;

            // guard
            if (!Number.isFinite(percent) || percent <= 0) return true;
            if (!Number.isFinite(this.durabilityMax) || this.durabilityMax <= 0) return false;

            // already broken
            if (this.durability <= 0) {
                this.durability = 0;
                return false;
            }

            const amount = Math.max(1, Math.ceil(this.durabilityMax * percent));
            this.durability = Math.max(0, this.durability - amount);

            return this.durability > 0;
        },

        addTreeCut(amount = 1) {
            this.treesCut += amount;
        },

        /**
         * Optional helper: set durability from equipped tool / inventory.
         * Useful when you switch tools and want correct values.
         */
        setToolDurability(durability: number, durabilityMax: number) {
            this.durabilityMax = Math.max(0, Math.floor(durabilityMax));
            this.durability = Math.min(Math.max(0, Math.floor(durability)), this.durabilityMax);
        },
    },
});