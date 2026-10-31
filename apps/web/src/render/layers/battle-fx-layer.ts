import { Container, Sprite } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
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

  const tool = new Container();
  const sprite = new Sprite();
  tool.addChild(sprite);
  tool.visible = false;
  container.addChild(tool);

  let url: string | null = null;
  let stopWatch: (() => void) | null = null;

  const fit = () => {
    applyObjectFit(sprite, w, h, EHexobjectGroup.TOOL);
    sprite.position.x -= w / 2;
    sprite.position.y -= h / 2;
  };

  function show(next: string) {
    if (next === url) return;
    stopWatch?.();
    url = next;
    sprite.texture = getTexture(next);
    stopWatch = onTextureReady(next, () => {
      sprite.texture = getTexture(next);
      fit();
    });
    fit();
  }

  function sync(fx: StrikeFx | null) {
    tool.visible = !!fx;
    if (!fx) return;
    const path = getPrototype(fx.toolKey as THexobjectKey).spritePath;
    if (path) show(path);
    tool.position.set(fx.tool.x, fx.tool.y);
    tool.alpha = fx.tool.alpha;
  }

  return {
    sync,
    destroy() {
      stopWatch?.();
      container.destroy({ children: true });
    },
  };
}
