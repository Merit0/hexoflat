import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Sprite, Ticker } from 'pixi.js';
import { createPortalLayer } from './portal-layer';
import { PORTAL_FX } from '@/render/portal-fx-config';
import { portalFxBusy } from '@/render/portal-fx';

const SIZE = { w: 83, h: 96 };
let now = 1000;

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

function setup() {
  const world = new Container();
  const layer = createPortalLayer({ worldContainer: world, getTileSize: () => SIZE });
  const portalSprites = () => world.children[0]?.children.flatMap((root) => root.children) ?? [];
  const frames = () =>
    (world.children[0]?.children ?? []).map((root) => root.children[1] as Sprite);
  return { world, layer, portalSprites, frames };
}

function advance(ms: number) {
  now += ms;
  Ticker.shared.update(now);
}

const A = { columnIndex: 3, rowIndex: 2 };
const B = { columnIndex: 4, rowIndex: 2 };

describe('portal layer', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('draws the vortex below the runes frame for every portal', () => {
    const { world, layer } = setup();

    layer.sync([A, B], 'camping:m1');

    const roots = world.children[0].children as Container[];
    expect(roots).toHaveLength(2);
    for (const root of roots) {
      expect(root.children).toHaveLength(3);
      expect(root.children[0]).toBeInstanceOf(Container);
      expect(root.children[0].children[0]).toBeInstanceOf(Sprite);
      expect(root.children[1]).toBeInstanceOf(Sprite);
    }
    layer.destroy();
  });

  it('does not play the open animation for portals already on the board when it loads', () => {
    const { world, layer } = setup();

    layer.sync([A], 'silesia:m1');

    expect(layer.isAnimating()).toBe(false);
    expect(world.children[0].children[0].scale.x).toBe(1);
    layer.destroy();
  });

  it('grows a newly opened portal over the open duration and locks input meanwhile', () => {
    const { world, layer } = setup();
    layer.sync([], 'silesia:m1');

    layer.sync([A], 'silesia:m1');

    expect(layer.isAnimating()).toBe(true);
    expect(portalFxBusy.value).toBe(true);
    const root = world.children[0].children[0];
    expect(root.scale.x).toBe(0);
    advance(PORTAL_FX.openMs / 2);
    expect(root.scale.x).toBeGreaterThan(0);
    expect(root.scale.x).toBeLessThan(1);
    advance(PORTAL_FX.openMs);
    expect(root.scale.x).toBe(1);
    expect(layer.isAnimating()).toBe(false);
    vi.advanceTimersByTime(PORTAL_FX.openMs);
    expect(portalFxBusy.value).toBe(false);
    layer.destroy();
  });

  it('spins the vortex continuously', () => {
    const { world, layer } = setup();
    layer.sync([A], 'silesia:m1');
    const vortex = world.children[0].children[0].children[0].children[0] as Sprite;

    advance(PORTAL_FX.spinPeriodMs / 4);

    expect(vortex.rotation).toBeCloseTo(
      Math.PI * 2 * ((now % PORTAL_FX.spinPeriodMs) / PORTAL_FX.spinPeriodMs),
      5,
    );
    layer.destroy();
  });

  it('fades a removed portal out, then drops it', () => {
    const { world, layer } = setup();
    layer.sync([A], 'silesia:m1');

    layer.sync([], 'silesia:m1');
    expect(layer.isAnimating()).toBe(true);
    advance(PORTAL_FX.closeMs + 10);

    expect(world.children[0].children).toHaveLength(0);
    expect(layer.isAnimating()).toBe(false);
    layer.destroy();
  });

  it('drops portals instantly when the board changes, without a fade', () => {
    const { world, layer } = setup();
    layer.sync([A], 'silesia:m1');

    layer.sync([], 'camping:m2');

    expect(world.children[0].children).toHaveLength(0);
    expect(layer.isAnimating()).toBe(false);
    layer.destroy();
  });

  it('only keeps the shared ticker running while a portal is on screen', () => {
    const { layer } = setup();
    const before = Ticker.shared.count;

    layer.sync([A], 'silesia:m1');
    expect(Ticker.shared.count).toBe(before + 1);

    layer.sync([], 'camping:m2');
    expect(Ticker.shared.count).toBe(before);
    layer.destroy();
  });
  it('REQ-1: a throwing portal tick is removed, logs once and later listeners still run', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { world, layer } = setup();
    const before = Ticker.shared.count;
    layer.sync([], 'silesia:m1');
    layer.sync([A], 'silesia:m1');
    let laterFrames = 0;
    const later = () => laterFrames++;
    Ticker.shared.add(later);
    world.children[0].children[0].destroy({ children: true });

    expect(() => advance(16)).not.toThrow();
    expect(laterFrames).toBe(1);
    expect(Ticker.shared.count).toBe(before + 1);
    advance(16);

    expect(laterFrames).toBe(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('portal-layer');
    Ticker.shared.remove(later);
    layer.destroy();
    expect(Ticker.shared.count).toBe(before);
  });

  it('REQ-2: destroying after the tick was removed leaves the listener count unchanged', () => {
    const { layer } = setup();
    const before = Ticker.shared.count;
    layer.sync([A], 'silesia:m1');
    layer.destroy();
    expect(Ticker.shared.count).toBe(before);

    layer.destroy();

    expect(Ticker.shared.count).toBe(before);
  });
});
