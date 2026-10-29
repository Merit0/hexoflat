import { Container, Graphics } from 'pixi.js';
import { buildHexPolygon } from '@/render/hex-geometry';
import { BATTLE_OVERLAY_COLORS } from '@/render/battle/battle-look';
import type { BattleOverlayModel } from '@/render/battle/battle-overlay-model';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleOverlayLayer {
  sync(model: BattleOverlayModel): void;
  destroy(): void;
}

const ZONE_TONES = new Set(['heroZone', 'enemyZone']);

export function createBattleOverlayLayer(
  deps: Omit<BattleLayerDeps, 'ticker'>,
): BattleOverlayLayer {
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);

  function sync(model: BattleOverlayModel) {
    const { w, h } = deps.tileSize;
    const polygon = buildHexPolygon(w, h).points;
    container.removeChildren().forEach((child) => child.destroy({ children: true }));

    for (const mark of model.marks) {
      const colors = BATTLE_OVERLAY_COLORS[mark.tone];
      const zone = ZONE_TONES.has(mark.tone);
      const g = new Graphics();
      g.poly(polygon)
        .fill({ color: colors.fill, alpha: zone ? 0.55 : 0.28 })
        .stroke({ color: colors.stroke, width: zone ? 2 : 3, alpha: 0.95 });
      const { x, y } = deps.positionOf(mark.hex);
      g.position.set(x, y);
      container.addChild(g);
    }
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
