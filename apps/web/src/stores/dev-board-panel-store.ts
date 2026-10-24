import { defineStore } from 'pinia';

export const useDevBoardPanelStore = defineStore('dev-board-panel-store', {
  state: () => ({
    showWholeBoard: false,
  }),
  actions: {
    toggleShowWholeBoard() {
      this.showWholeBoard = !this.showWholeBoard;
    },
  },
});
