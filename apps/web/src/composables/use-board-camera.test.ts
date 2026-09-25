import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { IDENTITY_CAMERA, type BoardFrame } from '@/render/board-camera';
import { useBoardCamera } from './use-board-camera';

function setup(frameValue: BoardFrame | null, focusValue: IHexCoordinates | null = null) {
  const frame = ref<BoardFrame | null>(frameValue);
  const focus = ref<IHexCoordinates | null>(focusValue);
  return useBoardCamera(
    computed(() => frame.value),
    computed(() => focus.value),
  );
}

describe('useBoardCamera', () => {
  it('keeps the identity camera until both the frame and the pane are known', () => {
    const noFrame = setup(null);
    noFrame.paneWidth.value = 1000;
    noFrame.paneHeight.value = 800;
    expect(noFrame.camera.value).toEqual(IDENTITY_CAMERA);

    const noPane = setup({ width: 18, height: 17 });
    expect(noPane.camera.value).toEqual(IDENTITY_CAMERA);
  });

  it('refits when the pane is resized, with the tile size following the zoom', () => {
    const board = setup({ width: 18, height: 17 });
    board.paneWidth.value = 1120;
    board.paneHeight.value = 900;
    const first = board.camera.value;

    board.paneWidth.value = 1792;
    board.paneHeight.value = 1440;
    const second = board.camera.value;

    expect(second.zoom).toBeGreaterThan(first.zoom);
    expect(board.screenTileSize.value.h / second.zoom).toBeCloseTo(
      board.screenTileSize.value.w / second.zoom / 0.866,
      5,
    );
  });

  it('keeps the canvas size fixed while the pane grows or shrinks inside the stage', () => {
    const board = setup({ width: 18, height: 17 });
    board.stageWidth.value = 1600;
    board.paneHeight.value = 900;

    board.paneWidth.value = 1120;
    const panelOpen = { ...board.canvasSize.value };
    const openCameraX = board.camera.value.x;

    board.paneWidth.value = 1568;
    const panelCollapsed = { ...board.canvasSize.value };

    expect(panelOpen).toEqual({ width: 1600, height: 900 });
    expect(panelCollapsed).toEqual(panelOpen);
    expect(board.camera.value.x).toBeGreaterThan(openCameraX);
  });

  it('gives every board sharing a frame the same camera, whatever its tile content', () => {
    const a = setup({ width: 18, height: 17 });
    const b = setup({ width: 18, height: 17 });
    for (const board of [a, b]) {
      board.paneWidth.value = 1120;
      board.paneHeight.value = 900;
    }
    expect(a.camera.value).toEqual(b.camera.value);
  });
});
