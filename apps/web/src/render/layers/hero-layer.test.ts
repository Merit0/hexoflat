import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Ticker } from 'pixi.js';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { createHeroLayer } from './hero-layer';
import { PORTAL_FX } from '@/render/portal-fx-config';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

const SIZE = { w: 83, h: 96 };
const HERO = { columnIndex: 2, rowIndex: 2 };
const PORTAL = { columnIndex: 3, rowIndex: 2 };
let now = 1_000_000;

function setup() {
  const world = new Container();
  const layer = createHeroLayer({ worldContainer: world, getTileSize: () => SIZE });
  layer.syncHero(HERO);
  const root = world.children[0];
  const body = root.children[1];
  return { layer, root, body };
}

async function play(promise: Promise<void>, durationMs: number) {
  now += durationMs + 10;
  Ticker.shared.update(now);
  await promise;
}

describe('hero layer: portal travel', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  it('shrinks, spins and fades the hero into the portal, then keeps it hidden', async () => {
    const { layer, body } = setup();

    await play(layer.playPortalEnter(PORTAL), PORTAL_FX.enterMs);

    const portalCentre = calcHexPixelPosition({ coordinates: PORTAL }, SIZE.w, SIZE.h);
    const heroPos = calcHexPixelPosition({ coordinates: HERO }, SIZE.w, SIZE.h);
    expect(body.alpha).toBe(0);
    expect(body.scale.x).toBeCloseTo(PORTAL_FX.heroEndScale, 5);
    expect(body.position.x).toBeCloseTo(SIZE.w / 2 + (portalCentre.x - heroPos.x), 5);

    layer.syncHero({ columnIndex: 5, rowIndex: 5 });
    expect(body.alpha).toBe(0);
    layer.destroy();
  });

  it('grows the hero out of the portal and restores the normal body', async () => {
    const { layer, body } = setup();
    await play(layer.playPortalEnter(PORTAL), PORTAL_FX.enterMs);

    await play(layer.playPortalExit(PORTAL), PORTAL_FX.exitMs);

    expect(body.alpha).toBe(1);
    expect(body.scale.x).toBe(1);
    expect(body.rotation).toBe(0);
    expect(body.position.x).toBe(SIZE.w / 2);
    layer.destroy();
  });

  it('releasePortal brings a hidden hero back', async () => {
    const { layer, body } = setup();
    await play(layer.playPortalEnter(PORTAL), PORTAL_FX.enterMs);

    layer.releasePortal();

    expect(body.alpha).toBe(1);
    expect(body.scale.x).toBe(1);
    layer.destroy();
  });
});
