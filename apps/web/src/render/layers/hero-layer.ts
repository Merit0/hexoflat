import { Container, Sprite, Ticker } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { applyCoverFit, createHexMask, drawHexMask } from '@/render/hex-geometry';
import { getTexture, onTextureReady } from '@/render/texture-cache';

const HERO_SPRITE_URL = '/hero-asssets/spirit-hex-image.png';

// Mirrors the DOM version's `.hero-hex-tile { transition: transform 180ms ease-out }`,
// which smoothed hero movement between tiles for free via CSS. Pixi has no
// equivalent, so this replicates it with a small position tween.
const MOVE_DURATION_MS = 180;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

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

  function stopTween() {
    if (tickerHandler) {
      Ticker.shared.remove(tickerHandler);
      tickerHandler = null;
    }
  }

  function tweenTo(targetX: number, targetY: number) {
    stopTween();
    const fromX = root.x;
    const fromY = root.y;
    const start = performance.now();

    tickerHandler = () => {
      const t = Math.min(1, (performance.now() - start) / MOVE_DURATION_MS);
      const eased = easeOutCubic(t);
      root.position.set(fromX + (targetX - fromX) * eased, fromY + (targetY - fromY) * eased);
      if (t >= 1) stopTween();
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
      tweenTo(x, y);
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
