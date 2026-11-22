import { itemLook } from '@/render/token-look';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { Container, Sprite } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { BattleHex, GroundItem } from '@hexoflat/engine/battle/battle-state';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';

export interface BattleLootLayerDeps {
  worldContainer: Container;
  tileSize: { w: number; h: number };
  positionOf(hex: BattleHex): { x: number; y: number };
  isHidden(hex: BattleHex): boolean;
}

export interface BattleLootLayer {
  sync(items: readonly GroundItem[]): void;
  refresh(): void;
  destroy(): void;
}

export function createBattleLootLayer(deps: BattleLootLayerDeps): BattleLootLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);
  let items: readonly GroundItem[] = [];
  let unsubscribers: Array<() => void> = [];

  function clear() {
    for (const stop of unsubscribers) stop();
    unsubscribers = [];
    container.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  function draw() {
    clear();
    for (const item of items) {
      if (deps.isHidden(item.hex)) continue;
      const meta = getPrototype(item.itemKey as THexobjectKey);
      const look = itemLook({ key: item.itemKey as THexobjectKey, token: item.token });
      if (!look.sprite) continue;
      const { x, y } = deps.positionOf(item.hex);
      const holder = new Container();
      holder.position.set(x, y);
      for (const [path, group] of [
        [look.light, EHexobjectGroup.CONSTRUCTION],
        [look.sprite, meta.groupType],
      ] as const) {
        if (!path) continue;
        const sprite = new Sprite(getTexture(path));
        const fit = () => applyObjectFit(sprite, w, h, group);
        fit();
        unsubscribers.push(
          onTextureReady(path, () => {
            sprite.texture = getTexture(path);
            fit();
          }),
        );
        holder.addChild(sprite);
      }
      container.addChild(holder);
    }
  }

  return {
    sync(next) {
      items = next;
      draw();
    },
    refresh: draw,
    destroy() {
      clear();
      container.destroy({ children: true });
    },
  };
}
