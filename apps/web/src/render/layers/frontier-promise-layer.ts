import { Container, Graphics } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

export type PromiseStrength = 'SUBTLE' | 'MEDIUM' | 'STRONG';

export interface FrontierPromiseEntry {
  key: string;
  coord: IHexCoordinates;
  strength: PromiseStrength;
}

export interface FrontierPromiseLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface FrontierPromiseLayer {
  sync(entries: FrontierPromiseEntry[]): void;
  destroy(): void;
}

const ALPHA: Record<PromiseStrength, number> = { SUBTLE: 0.28, MEDIUM: 0.45, STRONG: 0.62 };
const TINT = 0x9ec3e4;

export function createFrontierPromiseLayer(deps: FrontierPromiseLayerDeps): FrontierPromiseLayer {
  const container = new Container();
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

  function sync(entries: FrontierPromiseEntry[]) {
    const { w, h } = deps.getTileSize();
    const r = Math.min(w, h) * 0.42;

    entries.forEach((entry, index) => {
      const g = graphic(index);
      const { x, y } = calcHexPixelPosition({ coordinates: entry.coord }, w, h);
      g.position.set(x + w / 2, y + h / 2);
      g.clear();
      g.circle(0, 0, r * 2.1).fill({ color: TINT, alpha: ALPHA[entry.strength] * 0.22 });
      g.circle(0, 0, r * 1.35).fill({ color: TINT, alpha: ALPHA[entry.strength] * 0.5 });
      g.circle(0, 0, r * 0.7).fill({ color: TINT, alpha: ALPHA[entry.strength] });
    });

    for (let i = entries.length; i < pool.length; i += 1) pool[i].clear();
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
