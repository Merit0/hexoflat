import { defineStore } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

const COLLAPSED_STORAGE_KEY = 'hexoflat:dev-board-panel:collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    return;
  }
}

export const useDevBoardPanelStore = defineStore('dev-board-panel-store', {
  state: () => ({
    isCollapsed: readCollapsed(),
    showWholeBoard: false,
    highlightedCellKeys: [] as string[],
    params: { tier: 1, partySize: 1 },
    inspectMode: false,
    inspectedCoordinates: null as IHexCoordinates | null,
  }),
  actions: {
    toggleCollapsed() {
      this.isCollapsed = !this.isCollapsed;
      writeCollapsed(this.isCollapsed);
    },
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
