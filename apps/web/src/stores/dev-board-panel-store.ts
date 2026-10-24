import { defineStore } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export const useDevBoardPanelStore = defineStore('dev-board-panel-store', {
  state: () => ({
    showWholeBoard: false,
    highlightedCellKeys: [] as string[],
    params: { tier: 1, partySize: 1 },
    inspectMode: false,
    inspectedCoordinates: null as IHexCoordinates | null,
  }),
  actions: {
    toggleShowWholeBoard() {
      this.showWholeBoard = !this.showWholeBoard;
    },
    toggleInspectMode() {
      this.inspectMode = !this.inspectMode;
      this.inspectedCoordinates = null;
    },
    inspect(coordinates: IHexCoordinates) {
      this.inspectedCoordinates = { ...coordinates };
    },
    setHighlightedCellKeys(keys: readonly string[]) {
      this.highlightedCellKeys = [...keys];
    },
  },
});
