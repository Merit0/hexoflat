import { defineStore } from 'pinia';

export const useDevBoardPanelStore = defineStore('dev-board-panel-store', {
  state: () => ({
    showWholeBoard: false,
    showZoneOutlines: false,
  }),
  actions: {
    toggleShowWholeBoard() {
      this.showWholeBoard = !this.showWholeBoard;
    },
    toggleShowZoneOutlines() {
      this.showZoneOutlines = !this.showZoneOutlines;
    },
  },
});
