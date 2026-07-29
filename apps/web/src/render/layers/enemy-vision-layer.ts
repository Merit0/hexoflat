import { Container, Graphics } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';

export interface EnemyVisionCell {
  key: string;
  coord: IHexCoordinates;
}

export interface EnemyVisionLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface EnemyVisionLayer {
  syncCells(cells: EnemyVisionCell[]): void;
  destroy(): void;
}

const VISION_FILL = 0xff5c5c;

export function createEnemyVisionLayer(deps: EnemyVisionLayerDeps): EnemyVisionLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);

  const pool: Graphics[] = [];

  function getGraphic(index: number): Graphics {
    let g = pool[index];
    if (!g) {
      g = new Graphics();
      pool[index] = g;
      container.addChild(g);
    }
    return g;
  }

  function syncCells(cells: EnemyVisionCell[]) {
    const { w, h } = deps.getTileSize();

    cells.forEach((cell, index) => {
      const g = getGraphic(index);
      const { x, y } = calcHexPixelPosition({ coordinates: cell.coord }, w, h);
      g.position.set(x, y);
      g.clear();
      g.poly(buildHexPolygon(w, h).points).fill({ color: VISION_FILL, alpha: 0.16 });
    });

    for (let i = cells.length; i < pool.length; i++) {
      pool[i].clear();
    }
  }

  return {
    syncCells,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
