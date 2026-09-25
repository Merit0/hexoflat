import { describe, expect, it } from 'vitest';
import {
  fitBoardCamera,
  frameWorldRect,
  HEX_WORLD_HEIGHT,
  HEX_WORLD_WIDTH,
  IDENTITY_CAMERA,
  tileScreenSize,
  tileWorldCenter,
  worldToScreen,
  type WorldRect,
} from './board-camera';

const BOARD = frameWorldRect({ width: 18, height: 17 });

function screenRect(rect: WorldRect, camera: ReturnType<typeof fitBoardCamera>) {
  const topLeft = worldToScreen(camera, { x: rect.x, y: rect.y });
  return {
    left: topLeft.x,
    top: topLeft.y,
    right: topLeft.x + rect.width * camera.zoom,
    bottom: topLeft.y + rect.height * camera.zoom,
  };
}

describe('frameWorldRect', () => {
  it('spans the whole frame including the odd-row stagger and the last tile', () => {
    expect(BOARD.x).toBe(0);
    expect(BOARD.y).toBe(0);
    expect(BOARD.width).toBeCloseTo(HEX_WORLD_WIDTH * 18.5, 5);
    expect(BOARD.height).toBeCloseTo(HEX_WORLD_HEIGHT * (0.75 * 16 + 1), 5);
  });
});

describe('fitBoardCamera', () => {
  it('returns the identity camera until the pane has a real size', () => {
    expect(fitBoardCamera({ frameRect: BOARD, pane: { width: 0, height: 0 } })).toEqual(
      IDENTITY_CAMERA,
    );
  });

  it('fits the board on the tighter axis and centers it with equal margins', () => {
    const pane = { width: 1120, height: 900 };
    const camera = fitBoardCamera({ frameRect: BOARD, pane, minZoom: 0.1, maxZoom: 10 });
    const rect = screenRect(BOARD, camera);

    expect(camera.zoom).toBeCloseTo(
      Math.min(pane.width / BOARD.width, pane.height / BOARD.height),
      5,
    );
    expect(rect.left).toBeCloseTo(pane.width - rect.right, 5);
    expect(rect.top).toBeCloseTo(pane.height - rect.bottom, 5);
    expect(rect.left).toBeGreaterThanOrEqual(-1e-6);
    expect(rect.top).toBeGreaterThanOrEqual(-1e-6);
  });

  it('never zooms past maxZoom on a huge pane and keeps the board centered', () => {
    const pane = { width: 10000, height: 10000 };
    const camera = fitBoardCamera({ frameRect: BOARD, pane, maxZoom: 1.6 });
    const rect = screenRect(BOARD, camera);

    expect(camera.zoom).toBe(1.6);
    expect(rect.left).toBeCloseTo(pane.width - rect.right, 5);
    expect(rect.top).toBeCloseTo(pane.height - rect.bottom, 5);
  });

  it('holds minZoom on a small pane and follows the focus without leaving gaps at the edges', () => {
    const pane = { width: 400, height: 300 };
    const minZoom = 0.55;

    const centerFocus = tileWorldCenter({ columnIndex: 9, rowIndex: 8 });
    const centered = fitBoardCamera({ frameRect: BOARD, pane, focus: centerFocus, minZoom });
    expect(centered.zoom).toBe(minZoom);
    const focusOnScreen = worldToScreen(centered, centerFocus);
    expect(focusOnScreen.x).toBeCloseTo(pane.width / 2, 5);
    expect(focusOnScreen.y).toBeCloseTo(pane.height / 2, 5);

    const cornerFocus = tileWorldCenter({ columnIndex: 0, rowIndex: 0 });
    const clamped = screenRect(
      BOARD,
      fitBoardCamera({ frameRect: BOARD, pane, focus: cornerFocus, minZoom }),
    );
    expect(clamped.left).toBeCloseTo(0, 5);
    expect(clamped.top).toBeCloseTo(0, 5);
    expect(clamped.right).toBeGreaterThan(pane.width);
    expect(clamped.bottom).toBeGreaterThan(pane.height);
  });

  it('scales the on-screen tile with the camera zoom only', () => {
    expect(tileScreenSize({ zoom: 0.5, x: 10, y: 20 })).toEqual({
      w: HEX_WORLD_WIDTH * 0.5,
      h: HEX_WORLD_HEIGHT * 0.5,
    });
  });
});
