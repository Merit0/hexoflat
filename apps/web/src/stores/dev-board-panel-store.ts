import { defineStore } from 'pinia';

export const useDevBoardPanelStore = defineStore('dev-board-panel-store', {
  state: () => ({
    showWholeBoard: false,
    highlightedCellKeys: [] as string[],
    params: { tier: 1, partySize: 1 },
  }),
  actions: {
    toggleShowWholeBoard() {
      this.showWholeBoard = !this.showWholeBoard;
    },
    setHighlightedCellKeys(keys: readonly string[]) {
      this.highlightedCellKeys = [...keys];
    },
  },
});
