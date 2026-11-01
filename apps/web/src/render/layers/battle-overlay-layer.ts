import { Container, Graphics, Sprite } from 'pixi.js';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { BATTLE_SELECTED_COLOR, battleShieldSprite } from '@/render/battle/battle-look';
import { buildHexPolygon } from '@/render/hex-geometry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import type { BattleOverlayModel } from '@/render/battle/battle-overlay-model';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleOverlayLayer {
  sync(model: BattleOverlayModel): void;
  destroy(): void;
}

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

  function selectionOutline(x: number, y: number): Graphics {
    const { w, h } = deps.tileSize;
    const outline = new Graphics();
    outline
      .poly(buildHexPolygon(w, h).points)
      .fill({ color: BATTLE_SELECTED_COLOR, alpha: 0.18 })
      .stroke({ color: BATTLE_SELECTED_COLOR, width: 4, alpha: 0.95 });
    outline.position.set(x, y);
    return outline;
  }

  function sync(model: BattleOverlayModel) {
    clear();
    for (const mark of model.marks) {
      const { x, y } = deps.positionOf(mark.hex);
      if (mark.tone === 'selected') container.addChild(selectionOutline(x, y));
      else if (mark.tone === 'shield') container.addChild(shieldSprite(x, y));
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
