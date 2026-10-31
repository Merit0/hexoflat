import { Container, Graphics } from 'pixi.js';
import { buildHexPolygon } from '@/render/hex-geometry';
import { BATTLE_OVERLAY_COLORS } from '@/render/battle/battle-look';
import type { StrikeFx } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleFxLayer {
  sync(fx: StrikeFx | null): void;
  destroy(): void;
}

export function createBattleFxLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleFxLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);

  const rings = new Graphics();
  container.addChild(rings);
  const polygon = buildHexPolygon(w, h).points;
  const ringColors = BATTLE_OVERLAY_COLORS.ring;

  function sync(fx: StrikeFx | null) {
    rings.clear();
    if (!fx) return;
    for (const hex of fx.ring) {
      const { x, y } = deps.positionOf(hex);
      const shifted = polygon.map((v, i) => v + (i % 2 === 0 ? x : y));
      rings
        .poly(shifted)
        .fill({ color: ringColors.fill, alpha: 0.5 * fx.ringAlpha })
        .stroke({ color: ringColors.stroke, width: 4, alpha: fx.ringAlpha });
    }
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
