import { Container, Graphics, Sprite } from 'pixi.js';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { buildHexPolygon } from '@/render/hex-geometry';
import { BATTLE_OVERLAY_COLORS, battleShieldSprite } from '@/render/battle/battle-look';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
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

  let unsubscribers: Array<() => void> = [];

  function clear() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    container.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  function shieldSprite(x: number, y: number): Sprite {
    const { w, h } = deps.tileSize;
    const path = battleShieldSprite();
    const sprite = new Sprite(getTexture(path));
    const fit = () => {
      applyObjectFit(sprite, w, h, EHexobjectGroup.EQUIPMENT);
      sprite.position.x += x;
      sprite.position.y += y;
    };
    fit();
    unsubscribers.push(
      onTextureReady(path, () => {
        sprite.texture = getTexture(path);
        fit();
      }),
    );
    return sprite;
  }

  function sync(model: BattleOverlayModel) {
    const { w, h } = deps.tileSize;
    const polygon = buildHexPolygon(w, h).points;
    clear();

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
      if (mark.tone === 'shield') container.addChild(shieldSprite(x, y));
    }
  }

  return {
    sync,
    destroy() {
      clear();
      container.destroy({ children: true });
    },
  };
}
