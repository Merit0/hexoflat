import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useStaticBoardEditorStore } from './static-board-editor-store';

const { saveStaticBoardDrawingMock } = vi.hoisted(() => ({
  saveStaticBoardDrawingMock: vi.fn(),
}));

vi.mock('@/services/dev/static-board-save-client', () => ({
  saveStaticBoardDrawing: saveStaticBoardDrawingMock,
}));

const originalLocation = window.location;
let reloadMock: ReturnType<typeof vi.fn>;

describe('static-board-editor-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saveStaticBoardDrawingMock.mockReset();
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  it('starts editing only for a location with a static drawing', () => {
    const store = useStaticBoardEditorStore();

    store.startEditing('cave');
    expect(store.isEditing).toBe(false);

    store.startEditing('silesia');
    expect(store.isEditing).toBe(true);
    expect(store.draft?.id).toBe('silesia');
  });

  it('cancelEditing discards the draft', () => {
    const store = useStaticBoardEditorStore();
    store.startEditing('silesia');

    store.cancelEditing();

    expect(store.isEditing).toBe(false);
    expect(store.draft).toBeNull();
  });

  it('selecting a hex opens the palette, placing closes it and edits the draft', () => {
    const store = useStaticBoardEditorStore();
    store.startEditing('silesia');

    store.selectHex({ columnIndex: 0, rowIndex: 0 });
    expect(store.isPaletteOpen).toBe(true);

    store.placeWall();

    expect(store.isPaletteOpen).toBe(false);
    expect(store.draft?.rows[0].trim().split(/\s+/)[0]).toBe('#');
  });

  it('placeHexobject writes the chosen hexobject at the selected hex', () => {
    const store = useStaticBoardEditorStore();
    store.startEditing('silesia');
    store.selectHex({ columnIndex: 1, rowIndex: 1 });

    store.placeHexobject(HEXOBJECT_KEYS.CHEST);

    const placedLetter = store.draft?.rows[1].trim().split(/\s+/)[1];
    expect(placedLetter).toBeDefined();
    expect(store.draft?.legend[placedLetter as string]).toEqual({
      hexobjectKey: HEXOBJECT_KEYS.CHEST,
    });
  });

  it('save() reloads the page once the server confirms the write', async () => {
    saveStaticBoardDrawingMock.mockResolvedValue({ ok: true });
    const store = useStaticBoardEditorStore();
    store.startEditing('silesia');

    await store.save();

    expect(saveStaticBoardDrawingMock).toHaveBeenCalledWith(store.draft);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('save() surfaces the rejection reason and does not reload', async () => {
    saveStaticBoardDrawingMock.mockResolvedValue({ ok: false, reason: 'nope' });
    const store = useStaticBoardEditorStore();
    store.startEditing('silesia');

    await store.save();

    expect(store.saveError).toBe('nope');
    expect(store.isSaving).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  describe('terrain brushes, series and board objects', () => {
    const cellAt = (
      store: ReturnType<typeof useStaticBoardEditorStore>,
      column: number,
      row: number,
    ) => store.draft?.rows[row].trim().split(/\s+/)[column];

    it('placeMountain and placeWater write ^ and = to the selected hex', () => {
      const store = useStaticBoardEditorStore();
      store.startEditing('silesia');

      store.selectHex({ columnIndex: 1, rowIndex: 2 });
      store.placeMountain();
      store.selectHex({ columnIndex: 2, rowIndex: 2 });
      store.placeWater();

      expect(cellAt(store, 1, 2)).toBe('^');
      expect(cellAt(store, 2, 2)).toBe('=');
      expect(store.isPaletteOpen).toBe(false);
    });

    it('series mode keeps the chosen object for consecutive clicks until stopped', () => {
      const store = useStaticBoardEditorStore();
      store.startEditing('silesia');
      store.toggleSeries();

      store.selectHex({ columnIndex: 1, rowIndex: 2 });
      store.placeHexobject(HEXOBJECT_KEYS.TREE);
      expect(store.seriesKey).toBe(HEXOBJECT_KEYS.TREE);

      store.selectHex({ columnIndex: 3, rowIndex: 2 });
      store.selectHex({ columnIndex: 5, rowIndex: 2 });
      expect(store.isPaletteOpen).toBe(false);
      const trees = store.boardObjects.find((item) => item.hexobjectKey === HEXOBJECT_KEYS.TREE);
      expect(trees?.cellKeys).toEqual(expect.arrayContaining(['1:2', '3:2', '5:2']));

      store.stopSeries();
      store.selectHex({ columnIndex: 7, rowIndex: 2 });
      expect(store.isPaletteOpen).toBe(true);
    });

    it('without series mode a placed object does not stick to the cursor', () => {
      const store = useStaticBoardEditorStore();
      store.startEditing('silesia');

      store.selectHex({ columnIndex: 1, rowIndex: 2 });
      store.placeHexobject(HEXOBJECT_KEYS.TREE);

      expect(store.seriesKey).toBeNull();
    });

    it('removeAllOfKind clears a whole kind and cancelEditing resets series state', () => {
      const store = useStaticBoardEditorStore();
      store.startEditing('silesia');
      expect(store.boardObjects.some((item) => item.hexobjectKey === HEXOBJECT_KEYS.ROCK)).toBe(
        true,
      );

      store.removeAllOfKind(HEXOBJECT_KEYS.ROCK);
      expect(store.boardObjects.some((item) => item.hexobjectKey === HEXOBJECT_KEYS.ROCK)).toBe(
        false,
      );

      store.toggleSeries();
      store.cancelEditing();
      expect(store.isSeriesEnabled).toBe(false);
      expect(store.seriesKey).toBeNull();
    });
  });
});
