import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useHexBoardSizing, type HexBoardFrame } from './use-hex-board-sizing';

describe('useHexBoardSizing', () => {
  it('reports zero bounds until both the frame and the DOM tile size are known', () => {
    const frame = ref<HexBoardFrame | null>(null);
    const { mapBounds } = useHexBoardSizing(computed(() => frame.value));

    expect(mapBounds.value).toEqual({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  });

  it('sizes the board from the frame (width x height), not from how many tiles exist', () => {
    const frame = ref<HexBoardFrame | null>({ width: 18, height: 17 });
    const { domTileW, domTileH, mapBounds } = useHexBoardSizing(computed(() => frame.value));
    domTileW.value = 60;
    domTileH.value = 60;

    const bounds = mapBounds.value;

    // Frame corners: x spans col 0 (even row) to col 17 with the odd-row 0.5-tile stagger.
    expect(bounds.width).toBeCloseTo(60 * (17 + 0.5) + 60 + 4, 5);
    // y spans row 0 to row 16, tile height 60 with the 0.75 vertical overlap factor.
    expect(bounds.height).toBeCloseTo(60 * 0.75 * 16 + 60 + 4, 5);
  });

  it('gives the same bounds for a 1-tile board and an 18x17 board sharing the same frame', () => {
    const frame = ref<HexBoardFrame | null>({ width: 18, height: 17 });
    const a = useHexBoardSizing(computed(() => frame.value));
    a.domTileW.value = 60;
    a.domTileH.value = 60;

    const b = useHexBoardSizing(computed(() => frame.value));
    b.domTileW.value = 60;
    b.domTileH.value = 60;

    expect(a.mapBounds.value).toEqual(b.mapBounds.value);
  });
});
