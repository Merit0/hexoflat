import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export const HEX_WORLD_HEIGHT = 96;
export const HEX_WORLD_WIDTH = HEX_WORLD_HEIGHT * 0.866;
export const HEX_WORLD_SIZE = { w: HEX_WORLD_WIDTH, h: HEX_WORLD_HEIGHT } as const;

export const MIN_CAMERA_ZOOM = 0.55;
export const MAX_CAMERA_ZOOM = 1.6;

export interface BoardFrame {
  width: number;
  height: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaneSize {
  width: number;
  height: number;
}

export interface BoardCamera {
  zoom: number;
  x: number;
  y: number;
}

export const IDENTITY_CAMERA: BoardCamera = { zoom: 1, x: 0, y: 0 };

function frameCornerCoordinates(frame: BoardFrame): IHexCoordinates[] {
  const columns = [0, frame.width - 1];
  const rows = [...new Set([0, 1, frame.height - 2, frame.height - 1])].filter(
    (row) => row >= 0 && row < frame.height,
  );
  return rows.flatMap((rowIndex) => columns.map((columnIndex) => ({ columnIndex, rowIndex })));
}

export function frameWorldRect(frame: BoardFrame): WorldRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const coordinates of frameCornerCoordinates(frame)) {
    const { x, y } = calcHexPixelPosition({ coordinates }, HEX_WORLD_WIDTH, HEX_WORLD_HEIGHT);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + HEX_WORLD_WIDTH);
    maxY = Math.max(maxY, y + HEX_WORLD_HEIGHT);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function tileWorldCenter(coordinates: IHexCoordinates): WorldPoint {
  const { x, y } = calcHexPixelPosition({ coordinates }, HEX_WORLD_WIDTH, HEX_WORLD_HEIGHT);
  return { x: x + HEX_WORLD_WIDTH / 2, y: y + HEX_WORLD_HEIGHT / 2 };
}

function placeAxis(
  paneLength: number,
  rectStart: number,
  rectLength: number,
  focus: number,
  zoom: number,
): number {
  const scaledLength = rectLength * zoom;
  if (scaledLength <= paneLength) return (paneLength - scaledLength) / 2 - rectStart * zoom;

  const followed = paneLength / 2 - focus * zoom;
  const lowest = paneLength - (rectStart + rectLength) * zoom;
  const highest = -rectStart * zoom;
  return Math.min(highest, Math.max(lowest, followed));
}

export interface FitBoardCameraInput {
  frameRect: WorldRect;
  pane: PaneSize;
  focus?: WorldPoint | null;
  minZoom?: number;
  maxZoom?: number;
}

export function fitBoardCamera(input: FitBoardCameraInput): BoardCamera {
  const { frameRect, pane } = input;
  if (pane.width <= 0 || pane.height <= 0 || frameRect.width <= 0 || frameRect.height <= 0) {
    return IDENTITY_CAMERA;
  }

  const minZoom = input.minZoom ?? MIN_CAMERA_ZOOM;
  const maxZoom = input.maxZoom ?? MAX_CAMERA_ZOOM;
  const fitZoom = Math.min(pane.width / frameRect.width, pane.height / frameRect.height);
  const zoom = Math.min(maxZoom, Math.max(minZoom, fitZoom));

  const focus = input.focus ?? {
    x: frameRect.x + frameRect.width / 2,
    y: frameRect.y + frameRect.height / 2,
  };

  return {
    zoom,
    x: placeAxis(pane.width, frameRect.x, frameRect.width, focus.x, zoom),
    y: placeAxis(pane.height, frameRect.y, frameRect.height, focus.y, zoom),
  };
}

export function worldToScreen(camera: BoardCamera, point: WorldPoint): WorldPoint {
  return { x: camera.x + point.x * camera.zoom, y: camera.y + point.y * camera.zoom };
}

export function tileScreenSize(camera: BoardCamera): { w: number; h: number } {
  return { w: HEX_WORLD_WIDTH * camera.zoom, h: HEX_WORLD_HEIGHT * camera.zoom };
}
