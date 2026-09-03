import { Container, Sprite, Ticker } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { applyCoverFit, createHexMask, drawHexMask } from '@/render/hex-geometry';
import { getTexture, onTextureReady } from '@/render/texture-cache';

const HERO_SPRITE_URL = '/hero-asssets/spirit-hex-image.png';

const SMOOTH_TAU_MS = 78;
const SETTLE_PX = 0.15;

export interface HeroLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface HeroLayer {
  syncHero(coord: IHexCoordinates | null): void;
  destroy(): void;
}

export function createHeroLayer(deps: HeroLayerDeps): HeroLayer {
  // `root` stays unscaled — mask is defined in the same CSS-pixel units as
  // `w`/`h`. The Sprite itself gets scaled via applyCoverFit.
  const root = new Container();
  root.visible = false;
  deps.worldContainer.addChild(root);

  const mask = createHexMask(1, 1);
  const sprite = new Sprite();
  root.addChild(mask, sprite);
  root.mask = mask;

  const unsubscribe = onTextureReady(HERO_SPRITE_URL, () => {
    sprite.texture = getTexture(HERO_SPRITE_URL);
    const { w, h } = deps.getTileSize();
    applyCoverFit(sprite, w, h);
  });
  sprite.texture = getTexture(HERO_SPRITE_URL);

  let lastCoordKey: string | null = null;
  let tickerHandler: (() => void) | null = null;
  let targetX = 0;
  let targetY = 0;
  let lastFrameMs = 0;

  function stopTween() {
    if (tickerHandler) {
      Ticker.shared.remove(tickerHandler);
      tickerHandler = null;
    }
  }

  function easeToward(x: number, y: number) {
    targetX = x;
    targetY = y;
    if (tickerHandler) return;

    lastFrameMs = performance.now();
    tickerHandler = () => {
      const now = performance.now();
      const dt = Math.min(64, now - lastFrameMs);
      lastFrameMs = now;
      const k = 1 - Math.exp(-dt / SMOOTH_TAU_MS);
      root.position.set(root.x + (targetX - root.x) * k, root.y + (targetY - root.y) * k);

      if (Math.abs(targetX - root.x) < SETTLE_PX && Math.abs(targetY - root.y) < SETTLE_PX) {
        root.position.set(targetX, targetY);
        stopTween();
      }
    };
    Ticker.shared.add(tickerHandler);
  }

  function syncHero(coord: IHexCoordinates | null) {
    const wasVisible = root.visible;
    root.visible = !!coord;
    if (!coord) {
      stopTween();
      lastCoordKey = null;
      return;
    }

    const { w, h } = deps.getTileSize();
    applyCoverFit(sprite, w, h);
    drawHexMask(mask, w, h);

    const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
    const key = coordinateKey(coord);
    const isNewTile = key !== lastCoordKey;
    lastCoordKey = key;

    if (wasVisible && isNewTile) {
      easeToward(x, y);
    } else {
      stopTween();
      root.position.set(x, y);
    }
  }

  return {
    syncHero,
    destroy() {
      stopTween();
      unsubscribe();
      root.destroy({ children: true });
    },
  };
}
