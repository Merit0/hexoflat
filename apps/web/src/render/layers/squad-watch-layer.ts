import { Container, Graphics } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';

const WATCHED_HEX = { fill: 0x2a1719, stroke: 0x7a2a24, alpha: 0.55, scale: 0.94 };

export interface SquadWatchLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface SquadWatchLayer {
  sync(watched: IHexCoordinates[]): void;
  destroy(): void;
}

function scaledPolygon(w: number, h: number, scale: number, dx: number, dy: number): number[] {
  const points = buildHexPolygon(w * scale, h * scale).points;
  return points.map((value, i) =>
    i % 2 === 0 ? value + dx + (w * (1 - scale)) / 2 : value + dy + (h * (1 - scale)) / 2,
  );
}

export function createSquadWatchLayer(deps: SquadWatchLayerDeps): SquadWatchLayer {
  const layer = new Graphics();
  layer.eventMode = 'none';
  deps.worldContainer.addChild(layer);

  function sync(watched: IHexCoordinates[]) {
    const { w, h } = deps.getTileSize();
    layer.clear();
    for (const coord of watched) {
      const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
      layer
        .poly(scaledPolygon(w, h, WATCHED_HEX.scale, x, y))
        .fill({ color: WATCHED_HEX.fill, alpha: WATCHED_HEX.alpha })
        .stroke({ color: WATCHED_HEX.stroke, width: 2 });
    }
  }

  return {
    sync,
    destroy() {
      layer.destroy();
    },
  };
}
