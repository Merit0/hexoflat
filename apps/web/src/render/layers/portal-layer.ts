import { Container, Sprite, Ticker } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { createHexMask } from '@/render/hex-geometry';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { easeOutCubic } from '@/render/tween';
import { holdPortalFxFor } from '@/render/portal-fx';
import { PORTAL_FRAME_URL, PORTAL_FX, PORTAL_VORTEX_URL } from '@/render/portal-fx-config';

export interface PortalLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface PortalLayer {
  sync(portals: IHexCoordinates[], boardKey: string | null): void;
  isAnimating(): boolean;
  destroy(): void;
}

interface PortalNode {
  root: Container;
  vortexHolder: Container;
  vortex: Sprite;
  frame: Sprite;
  phase: 'opening' | 'open' | 'closing';
  phaseStart: number;
}

function fitToTile(sprite: Sprite, tile: { w: number; h: number }) {
  const textureWidth = sprite.texture.width;
  if (textureWidth > 1) sprite.scale.set(Math.max(tile.w, tile.h) / textureWidth);
}

function createSprite(
  url: string,
  getTile: () => { w: number; h: number },
): { sprite: Sprite; unsubscribe: () => void } {
  const sprite = new Sprite(getTexture(url));
  sprite.anchor.set(0.5);
  sprite.eventMode = 'none';
  fitToTile(sprite, getTile());
  const unsubscribe = onTextureReady(url, () => {
    sprite.texture = getTexture(url);
    fitToTile(sprite, getTile());
  });
  return { sprite, unsubscribe };
}

export function createPortalLayer(deps: PortalLayerDeps): PortalLayer {
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);

  const nodes = new Map<string, PortalNode>();
  const unsubscribes: Array<() => void> = [];
  let boardKey: string | null | undefined;
  let tickerHandler: (() => void) | null = null;

  function tick() {
    const now = performance.now();
    for (const [key, node] of nodes) {
      const spin = (now % PORTAL_FX.spinPeriodMs) / PORTAL_FX.spinPeriodMs;
      node.vortex.rotation = spin * Math.PI * 2;
      const wave = 0.5 + 0.5 * Math.sin((now / PORTAL_FX.pulseMs) * Math.PI * 2);
      node.vortex.alpha = PORTAL_FX.pulseMinAlpha + (1 - PORTAL_FX.pulseMinAlpha) * wave;

      const elapsed = now - node.phaseStart;
      if (node.phase === 'opening') {
        const t = Math.min(1, elapsed / PORTAL_FX.openMs);
        node.root.scale.set(easeOutCubic(t));
        if (t >= 1) node.phase = 'open';
      } else if (node.phase === 'closing') {
        const t = Math.min(1, elapsed / PORTAL_FX.closeMs);
        node.vortexHolder.scale.set(1 - t);
        node.frame.alpha = 1 - t;
        if (t >= 1) {
          node.root.destroy({ children: true });
          nodes.delete(key);
        }
      }
    }
    updateTicker();
  }

  function updateTicker() {
    if (nodes.size > 0 && !tickerHandler) {
      tickerHandler = tick;
      Ticker.shared.add(tickerHandler);
    } else if (nodes.size === 0 && tickerHandler) {
      Ticker.shared.remove(tickerHandler);
      tickerHandler = null;
    }
  }

  function addNode(coord: IHexCoordinates, animate: boolean) {
    const { w, h } = deps.getTileSize();
    const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
    const vortex = createSprite(PORTAL_VORTEX_URL, () => deps.getTileSize());
    const frame = createSprite(PORTAL_FRAME_URL, () => deps.getTileSize());
    unsubscribes.push(vortex.unsubscribe, frame.unsubscribe);

    const root = new Container();
    root.eventMode = 'none';
    root.position.set(x + w / 2, y + h / 2);
    const vortexHolder = new Container();
    vortexHolder.addChild(vortex.sprite);
    const mask = createHexMask(w, h);
    mask.position.set(-w / 2, -h / 2);
    root.addChild(vortexHolder, frame.sprite, mask);
    root.mask = mask;
    container.addChild(root);

    nodes.set(coordinateKey(coord), {
      root,
      vortexHolder,
      vortex: vortex.sprite,
      frame: frame.sprite,
      phase: animate ? 'opening' : 'open',
      phaseStart: performance.now(),
    });
    if (animate) {
      root.scale.set(0);
      holdPortalFxFor(PORTAL_FX.openMs);
    }
  }

  function clearAll() {
    for (const node of nodes.values()) node.root.destroy({ children: true });
    nodes.clear();
  }

  function sync(portals: IHexCoordinates[], nextBoardKey: string | null) {
    const boardChanged = nextBoardKey !== boardKey;
    boardKey = nextBoardKey;
    if (boardChanged) clearAll();

    const wanted = new Map(portals.map((coord) => [coordinateKey(coord), coord]));
    for (const [key, coord] of wanted) {
      const existing = nodes.get(key);
      if (!existing) addNode(coord, !boardChanged);
      else if (existing.phase === 'closing') {
        existing.phase = 'open';
        existing.vortexHolder.scale.set(1);
        existing.frame.alpha = 1;
      }
    }
    for (const [key, node] of nodes) {
      if (wanted.has(key) || node.phase === 'closing') continue;
      node.phase = 'closing';
      node.phaseStart = performance.now();
      holdPortalFxFor(PORTAL_FX.closeMs);
    }
    updateTicker();
  }

  return {
    sync,
    isAnimating: () =>
      [...nodes.values()].some((node) => node.phase === 'opening' || node.phase === 'closing'),
    destroy() {
      if (tickerHandler) Ticker.shared.remove(tickerHandler);
      tickerHandler = null;
      for (const unsubscribe of unsubscribes) unsubscribe();
      clearAll();
      container.destroy({ children: true });
    },
  };
}
