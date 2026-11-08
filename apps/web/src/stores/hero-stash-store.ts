import { defineStore } from 'pinia';
import { emptyStash } from '@hexoflat/engine/inventory/stash-state';
import type { StashCells } from '@/services/persistence/stash-storage';
import { readSavedStash, writeSavedStash } from '@/services/persistence/stash-storage';

export const useHeroStashStore = defineStore('heroStash', {
  state: () => ({
    cells: emptyStash().cells,
    isOpen: false,
    isHydrated: false,
  }),

  getters: {
    usedCount: (state): number => state.cells.filter((cell) => cell !== null).length,
    capacity: (state): number => state.cells.length,
  },

  actions: {
    hydrate() {
      if (this.isHydrated) return;
      const saved = readSavedStash();
      if (saved) this.cells = saved;
      this.isHydrated = true;
    },

    open() {
      this.hydrate();
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    replaceCells(cells: StashCells) {
      this.cells = cells;
      writeSavedStash(this.cells);
    },
  },
});
