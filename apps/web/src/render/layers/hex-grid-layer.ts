import { Container, Graphics } from 'pixi.js';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';

export interface HexGridLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface HexGridLayer {
  sync(tiles: IHexTile[], enabled: boolean): void;
  destroy(): void;
}

const STROKE = 0x8fd3ff;

export function createHexGridLayer(deps: HexGridLayerDeps): HexGridLayer {
  const container = new Container();
  container.zIndex = 900;
  deps.worldContainer.addChild(container);

  const pool: Graphics[] = [];

  function graphic(index: number): Graphics {
    let g = pool[index];
    if (!g) {
      g = new Graphics();
      pool[index] = g;
      container.addChild(g);
    }
    return g;
  }

  function sync(tiles: IHexTile[], enabled: boolean) {
    const { w, h } = deps.getTileSize();
    const list = enabled ? tiles : [];

    list.forEach((tile, index) => {
      const g = graphic(index);
      const { x, y } = calcHexPixelPosition({ coordinates: tile.coordinates }, w, h);
      g.position.set(x, y);
      g.clear();
      g.poly(buildHexPolygon(w, h).points).stroke({ color: STROKE, width: 1, alpha: 0.55 });
    });

    for (let i = list.length; i < pool.length; i += 1) pool[i].clear();
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
