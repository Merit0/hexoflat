import { Container, Sprite } from 'pixi.js';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { createHexMask, drawHexMask } from '@/render/hex-geometry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';

export interface HexToken {
  root: Container;
  body: Container;
  setSprite(url: string): void;
  layout(w: number, h: number): void;
  destroy(): void;
}

export function createHexToken(url?: string): HexToken {
  const root = new Container();
  const mask = createHexMask(1, 1);
  const body = new Container();
  const sprite = new Sprite();
  body.addChild(sprite);
  root.addChild(mask, body);
  root.mask = mask;

  let current: string | null = null;
  let size = { w: 0, h: 0 };
  let unsubscribe: (() => void) | null = null;

  const fit = () => applyObjectFit(sprite, size.w, size.h, EHexobjectGroup.CREATURE);

  function setSprite(next: string) {
    if (next === current) return;
    unsubscribe?.();
    current = next;
    sprite.texture = getTexture(next);
    unsubscribe = onTextureReady(next, () => {
      sprite.texture = getTexture(next);
      fit();
    });
    fit();
  }

  if (url) setSprite(url);

  return {
    root,
    body,
    setSprite,
    layout(w, h) {
      size = { w, h };
      fit();
      drawHexMask(mask, w, h);
      body.pivot.set(w / 2, h / 2);
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = null;
      root.destroy({ children: true });
    },
  };
}
