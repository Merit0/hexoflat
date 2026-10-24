import { defineStore } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { StaticBoardDrawing } from '@hexoflat/engine/content/boards/schemas';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { buildStaticBoard } from '@hexoflat/engine/boards/build-static-board';
import {
  placeGroundAt,
  placeWallAt,
  placeVoidAt,
  placeHexobjectAt,
  placeMountainAt,
  placeWaterAt,
  listBoardObjects,
  removeAllOfKind,
} from '@hexoflat/engine/boards/static-board-editor';
import { saveStaticBoardDrawing } from '@/services/dev/static-board-save-client';

export const useStaticBoardEditorStore = defineStore('static-board-editor-store', {
  state: () => ({
    isEditing: false,
    locationKey: null as LocationKey | null,
    draft: null as StaticBoardDrawing | null,
    selectedCoordinates: null as IHexCoordinates | null,
    paletteSearch: '',
    isSaving: false,
    saveError: null as string | null,
    isSeriesEnabled: false,
    seriesKey: null as THexobjectKey | null,
  }),

  getters: {
    draftMap: (state) => (state.draft ? buildStaticBoard(state.draft).map : null),
    isPaletteOpen: (state) => state.selectedCoordinates !== null,
    boardObjects: (state) => (state.draft ? listBoardObjects(state.draft) : []),
  },

  actions: {
    startEditing(locationKey: LocationKey) {
      const drawing = MapRegistry.get(locationKey).staticDrawing;
      if (!drawing) return;

      this.isEditing = true;
      this.locationKey = locationKey;
      this.draft = drawing;
      this.selectedCoordinates = null;
      this.paletteSearch = '';
      this.saveError = null;
      this.isSeriesEnabled = false;
      this.seriesKey = null;
    },

    cancelEditing() {
      this.isSeriesEnabled = false;
      this.seriesKey = null;
      this.isEditing = false;
      this.locationKey = null;
      this.draft = null;
      this.selectedCoordinates = null;
      this.paletteSearch = '';
      this.saveError = null;
    },

    selectHex(coordinates: IHexCoordinates) {
      if (this.draft && this.seriesKey) {
        this.draft = placeHexobjectAt(this.draft, coordinates, this.seriesKey);
        return;
      }
      this.selectedCoordinates = coordinates;
    },

    toggleSeries() {
      this.isSeriesEnabled = !this.isSeriesEnabled;
      if (!this.isSeriesEnabled) this.seriesKey = null;
    },

    stopSeries() {
      this.seriesKey = null;
    },

    closePalette() {
      this.selectedCoordinates = null;
      this.paletteSearch = '';
    },

    setPaletteSearch(text: string) {
      this.paletteSearch = text;
    },

    placeGround() {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeGroundAt(this.draft, this.selectedCoordinates);
      this.closePalette();
    },

    placeWall() {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeWallAt(this.draft, this.selectedCoordinates);
      this.closePalette();
    },

    placeVoid() {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeVoidAt(this.draft, this.selectedCoordinates);
      this.closePalette();
    },

    placeMountain() {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeMountainAt(this.draft, this.selectedCoordinates);
      this.closePalette();
    },

    placeWater() {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeWaterAt(this.draft, this.selectedCoordinates);
      this.closePalette();
    },

    placeHexobject(hexobjectKey: THexobjectKey) {
      if (!this.draft || !this.selectedCoordinates) return;
      this.draft = placeHexobjectAt(this.draft, this.selectedCoordinates, hexobjectKey);
      if (this.isSeriesEnabled) this.seriesKey = hexobjectKey;
      this.closePalette();
    },

    removeAllOfKind(hexobjectKey: THexobjectKey) {
      if (!this.draft) return;
      this.draft = removeAllOfKind(this.draft, hexobjectKey);
      if (this.seriesKey === hexobjectKey) this.seriesKey = null;
    },

    async save() {
      if (!this.draft) return;

      this.isSaving = true;
      this.saveError = null;

      const result = await saveStaticBoardDrawing(this.draft);

      if (!result.ok) {
        this.isSaving = false;
        this.saveError = result.reason ?? 'save failed';
        return;
      }

      window.location.reload();
    },
  },
});
