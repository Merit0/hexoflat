import { defineStore } from 'pinia';
import { emptyStash } from '@hexoflat/engine/inventory/stash-state';
import {
  STASH_CAPACITY,
  STASH_CHEST_CELLS,
  STASH_MAX_CHESTS,
} from '@hexoflat/engine/inventory/stash-constants';
import type { StashFilter } from '@/composables/stash-filter';
import type { StashCells } from '@/services/persistence/stash-storage';
import { readSavedStash, writeSavedStash } from '@/services/persistence/stash-storage';
import { starterStashCells } from '@/services/inventory/starter-stash';

function pad(cells: StashCells): StashCells {
  return Array.from({ length: STASH_CAPACITY }, (_, index) => cells[index] ?? null);
}

interface HeroStashState {
  cells: StashCells;
  chests: number;
  activeChest: number;
  filter: StashFilter;
  isOpen: boolean;
  isHydrated: boolean;
}

export const useHeroStashStore = defineStore('heroStash', {
  state: (): HeroStashState => ({
    cells: emptyStash().cells,
    chests: 0,
    activeChest: 0,
    filter: 'all',
    isOpen: false,
    isHydrated: false,
  }),

  getters: {
    capacity: (state): number => state.chests * STASH_CHEST_CELLS,
    ownedCells: (state): StashCells => state.cells.slice(0, state.chests * STASH_CHEST_CELLS),
    usedCount(): number {
      return this.ownedCells.filter((cell) => cell !== null).length;
    },
    preferredRange(state): { start: number; end: number } {
      const start = state.activeChest * STASH_CHEST_CELLS;
      return { start, end: start + STASH_CHEST_CELLS };
    },
  },

  actions: {
    hydrate() {
      if (this.isHydrated) return;
      const saved = readSavedStash();
      if (saved) {
        this.cells = saved.cells;
        this.chests = saved.chests;
      } else {
        this.cells = starterStashCells();
        this.persist();
      }
      this.isHydrated = true;
    },

    open() {
      this.hydrate();
      this.activeChest = Math.min(this.activeChest, Math.max(0, this.chests - 1));
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    setFilter(filter: StashFilter) {
      this.filter = filter;
    },

    selectChest(index: number) {
      this.activeChest = Math.min(STASH_MAX_CHESTS - 1, Math.max(0, index));
    },

    replaceOwnedCells(cells: StashCells) {
      this.cells = pad(cells);
      this.persist();
    },

    setChests(chests: number) {
      this.chests = Math.min(STASH_MAX_CHESTS, Math.max(0, chests));
      this.persist();
    },

    persist() {
      writeSavedStash({ chests: this.chests, cells: this.cells });
    },
  },
});
