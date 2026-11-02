import { Container, Sprite } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { bloodSplashFrames, splashFrameIndex } from '@/render/blood-splash';
import { BATTLE_MOTION } from '@/render/battle/battle-timing';
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

  const splashes: Sprite[] = [];
  const splashSprite = (index: number): Sprite => {
    while (splashes.length <= index) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.visible = false;
      container.addChild(sprite);
      splashes.push(sprite);
    }
    return splashes[index];
  };

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

  function syncSplash(fx: StrikeFx | null) {
    const frames = bloodSplashFrames();
    const state = frames.length > 0 ? fx?.splash : null;
    const points = state?.at ?? [];
    splashes.forEach((sprite, i) => {
      sprite.visible = !!state && i < points.length;
    });
    if (!state) return;
    const texture = frames[splashFrameIndex(state.progress, frames.length)];
    points.forEach((point, i) => {
      const sprite = splashSprite(i);
      sprite.texture = texture;
      sprite.scale.set((h * BATTLE_MOTION.splashSizeTiles) / texture.height);
      sprite.position.set(point.x, point.y);
      sprite.visible = true;
    });
  }

  function sync(fx: StrikeFx | null) {
    syncSplash(fx);
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
