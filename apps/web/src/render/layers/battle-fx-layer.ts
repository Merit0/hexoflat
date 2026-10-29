import { Container, Graphics } from 'pixi.js';
import { buildHexPolygon } from '@/render/hex-geometry';
import { BATTLE_OVERLAY_COLORS, BATTLE_SWORD_COLORS } from '@/render/battle/battle-look';
import type { StrikeFx } from '@/render/battle/battle-animation-sample';
import { BATTLE_MOTION } from '@/render/battle/battle-timing';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleFxLayer {
  sync(fx: StrikeFx | null): void;
  destroy(): void;
}

function drawSword(length: number): Graphics {
  const blade = length * 0.72;
  const g = new Graphics();
  g.poly([0, -2.5, blade, -1.2, blade + 7, 0, blade, 1.2, 0, 2.5]).fill({
    color: BATTLE_SWORD_COLORS.blade,
  });
  g.rect(-1, -7, 3, 14).fill({ color: BATTLE_SWORD_COLORS.guard });
  g.rect(-length * 0.22, -1.8, length * 0.22, 3.6).fill({ color: BATTLE_SWORD_COLORS.grip });
  g.pivot.set(blade + 7, 0);
  return g;
}

export function createBattleFxLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleFxLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);

  const rings = new Graphics();
  const sword = drawSword(w * BATTLE_MOTION.swordLength);
  container.addChild(rings, sword);
  const polygon = buildHexPolygon(w, h).points;
  const ringColors = BATTLE_OVERLAY_COLORS.ring;

  function sync(fx: StrikeFx | null) {
    rings.clear();
    sword.visible = !!fx;
    if (!fx) return;
    for (const hex of fx.ring) {
      const { x, y } = deps.positionOf(hex);
      const shifted = polygon.map((v, i) => v + (i % 2 === 0 ? x : y));
      rings
        .poly(shifted)
        .fill({ color: ringColors.fill, alpha: 0.5 * fx.ringAlpha })
        .stroke({ color: ringColors.stroke, width: 4, alpha: fx.ringAlpha });
    }
    sword.position.set(fx.sword.x, fx.sword.y);
    sword.rotation = fx.sword.rotation;
    sword.alpha = fx.sword.alpha;
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
