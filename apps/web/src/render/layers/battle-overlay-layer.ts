import { Container, Sprite } from 'pixi.js';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { battleShieldSprite } from '@/render/battle/battle-look';
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

  function sync(model: BattleOverlayModel) {
    clear();
    for (const mark of model.marks) {
      if (mark.tone !== 'shield') continue;
      const { x, y } = deps.positionOf(mark.hex);
      container.addChild(shieldSprite(x, y));
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
