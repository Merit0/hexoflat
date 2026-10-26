import { Container, Sprite, Ticker } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { applyCoverFit, createHexMask, drawHexMask } from '@/render/hex-geometry';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { easeOutCubic, runTween, type Tween } from '@/render/tween';
import { PORTAL_FX } from '@/render/portal-fx-config';

const HERO_SPRITE_URL = '/hero-asssets/human-hex.png';

const MOVE_DURATION_MS = 180;

export interface HeroLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface HeroLayer {
  syncHero(coord: IHexCoordinates | null): void;
  playPortalEnter(portal: IHexCoordinates): Promise<void>;
  playPortalExit(portal: IHexCoordinates): Promise<void>;
  releasePortal(): void;
  destroy(): void;
}

export function createHeroLayer(deps: HeroLayerDeps): HeroLayer {
  // `root` stays unscaled — mask is defined in the same CSS-pixel units as
  // `w`/`h`. The Sprite itself gets scaled via applyCoverFit.
  const root = new Container();
  root.visible = false;
  deps.worldContainer.addChild(root);

  const mask = createHexMask(1, 1);
  const body = new Container();
  const sprite = new Sprite();
  body.addChild(sprite);
  root.addChild(mask, body);
  root.mask = mask;

  const unsubscribe = onTextureReady(HERO_SPRITE_URL, () => {
    sprite.texture = getTexture(HERO_SPRITE_URL);
    const { w, h } = deps.getTileSize();
    applyCoverFit(sprite, w, h);
  });
  sprite.texture = getTexture(HERO_SPRITE_URL);

  let lastCoordKey: string | null = null;
  let heroTarget = { x: 0, y: 0 };
  let portalTween: Tween | null = null;
  let heldByPortal = false;
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

    body.pivot.set(w / 2, h / 2);
    if (!portalTween && !heldByPortal) body.position.set(w / 2, h / 2);
    const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
    heroTarget = { x, y };
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

  function portalOffset(portal: IHexCoordinates, from: { x: number; y: number }) {
    const { w, h } = deps.getTileSize();
    const centre = calcHexPixelPosition({ coordinates: portal }, w, h);
    return { dx: centre.x - from.x, dy: centre.y - from.y };
  }

  function resetBody() {
    const { w, h } = deps.getTileSize();
    body.position.set(w / 2, h / 2);
    body.scale.set(1);
    body.rotation = 0;
    body.alpha = 1;
  }

  function playPortalEnter(portal: IHexCoordinates): Promise<void> {
    portalTween?.cancel();
    const { w, h } = deps.getTileSize();
    const { dx, dy } = portalOffset(portal, { x: root.x, y: root.y });
    heldByPortal = true;
    portalTween = runTween(PORTAL_FX.enterMs, (t) => {
      const e = easeOutCubic(t);
      body.position.set(w / 2 + dx * e, h / 2 + dy * e);
      body.scale.set(1 - (1 - PORTAL_FX.heroEndScale) * e);
      body.rotation = Math.PI * 2 * e;
      body.alpha = 1 - e;
    });
    return portalTween.done.then(() => {
      portalTween = null;
      body.alpha = 0;
    });
  }

  function playPortalExit(portal: IHexCoordinates): Promise<void> {
    portalTween?.cancel();
    stopTween();
    const { w, h } = deps.getTileSize();
    root.position.set(heroTarget.x, heroTarget.y);
    const { dx, dy } = portalOffset(portal, heroTarget);
    portalTween = runTween(PORTAL_FX.exitMs, (t) => {
      const e = easeOutCubic(t);
      body.position.set(w / 2 + dx * (1 - e), h / 2 + dy * (1 - e));
      body.scale.set(PORTAL_FX.heroEndScale + (1 - PORTAL_FX.heroEndScale) * e);
      body.rotation = Math.PI * 2 * (e - 1);
      body.alpha = e;
    });
    return portalTween.done.then(() => {
      portalTween = null;
      heldByPortal = false;
      resetBody();
    });
  }

  function releasePortal() {
    portalTween?.cancel();
    portalTween = null;
    heldByPortal = false;
    resetBody();
  }

  return {
    syncHero,
    playPortalEnter,
    playPortalExit,
    releasePortal,
    destroy() {
      portalTween?.cancel();
      stopTween();
      unsubscribe();
      root.destroy({ children: true });
    },
  };
}
