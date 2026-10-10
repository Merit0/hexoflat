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
});
