import { tileScreenSize, type BoardCamera, type WorldRect } from './board-camera';

export function boardOverlayStyle(camera: BoardCamera, frameRect: WorldRect | null) {
  const tile = tileScreenSize(camera);
  return {
    width: `${(frameRect?.width ?? 0) * camera.zoom}px`,
    height: `${(frameRect?.height ?? 0) * camera.zoom}px`,
    transform: `translate(${camera.x}px, ${camera.y}px)`,
    '--hex-tile-width': `${tile.w}px`,
    '--hex-tile-height': `${tile.h}px`,
  };
}
