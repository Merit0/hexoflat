import { Container, Graphics, Text } from 'pixi.js';
import { buildHexPolygon } from '@/render/hex-geometry';
import { BATTLE_OVERLAY_COLORS } from '@/render/battle/battle-look';
import type { BattleOverlayModel } from '@/render/battle/battle-overlay-model';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleOverlayLayer {
  sync(model: BattleOverlayModel): void;
  destroy(): void;
}

const ZONE_TONES = new Set(['heroZone', 'enemyZone']);
const LABEL_STYLE = {
  fontFamily: 'Cinzel, serif',
  fontSize: 11,
  fontWeight: '800',
  fill: 0xf2f4fa,
} as const;

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

    for (const badge of model.badges) {
      const { x, y } = deps.positionOf(badge.hex);
      const chip = new Graphics();
      chip
        .circle(0, 0, w * 0.13)
        .fill({ color: 0xc2412d })
        .stroke({ color: 0xf2f4fa, width: 2 });
      chip.position.set(x + w * 0.82, y + h * 0.22);
      const text = new Text({ text: badge.text, style: LABEL_STYLE });
      text.anchor.set(0.5);
      text.position.copyFrom(chip.position);
      container.addChild(chip, text);
    }
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
