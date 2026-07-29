import { defineStore } from "pinia";
import type { THexobjectKey } from "@/registry/hexobjects-registry";

export interface GatheringState {
    counts: Partial<Record<THexobjectKey, number>>;
}

export const useGatheringStore = defineStore("gathering", {
    state: (): GatheringState => ({
        counts: {},
    }),

    getters: {
        getCount: (s) => (key: THexobjectKey) => s.counts[key] ?? 0,
    },

    actions: {
        add(key: THexobjectKey, amount = 1) {
            const prev = this.counts[key] ?? 0;
            this.counts[key] = prev + Math.max(0, amount);
        },

        set(key: THexobjectKey, value: number) {
            this.counts[key] = Math.max(0, value);
        },

        reset() {
            this.counts = {};
        },
    },
});