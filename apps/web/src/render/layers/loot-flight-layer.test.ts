import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Ticker } from 'pixi.js';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { LootFlight, LootFlightRequest } from '@/services/loot/loot-flight';
import { createLootFlightLayer } from './loot-flight-layer';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

let now = 0;

function flight(columnIndex: number): LootFlight {
  return {
    itemKey: HEXOBJECT_KEYS.SWORD,
    from: { columnIndex: 0, rowIndex: 0 },
    to: { columnIndex, rowIndex: 1 },
    delayMs: 0,
    landingKey: `${columnIndex}:1`,
  };
}

function request(id: number, ...flights: LootFlight[]): LootFlightRequest {
  return { id, flights, flightMs: 400, accentMs: 100, totalMs: 600 };
}

function layerWith(onLanded = vi.fn()) {
  const layer = createLootFlightLayer({
    worldContainer: new Container(),
    getTileSize: () => ({ w: 60, h: 60 }),
    onLanded,
  });
  return { layer, onLanded };
}

describe('loot flight layer lifecycle', () => {
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it('stops its shared-ticker frames when destroyed in the middle of a flight', async () => {
    const before = Ticker.shared.count;
    const { layer, onLanded } = layerWith();
    const played = layer.play(request(1, flight(1)));
    now = 100;
    Ticker.shared.update(now);
    expect(Ticker.shared.count).toBe(before + 1);

    layer.destroy();

    expect(Ticker.shared.count).toBe(before);
    now = 200;
    expect(() => Ticker.shared.update(now)).not.toThrow();
    await expect(played).resolves.toBeUndefined();
    expect(onLanded).not.toHaveBeenCalled();
  });

  it('lets later shared-ticker animations run after a board left mid-flight', () => {
    const { layer } = layerWith();
    void layer.play(request(1, flight(1)));
    layer.destroy();

    const later = vi.fn();
    Ticker.shared.add(later);
    now = 50;
    Ticker.shared.update(now);
    Ticker.shared.remove(later);

    expect(later).toHaveBeenCalled();
  });

  it('cancels the running flight when a new one replaces it and still lands the old items', async () => {
    const before = Ticker.shared.count;
    const { layer, onLanded } = layerWith();
    const first = layer.play(request(1, flight(1)));
    now = 100;
    Ticker.shared.update(now);

    const second = layer.play(request(2, flight(2)));
    await first;
    expect(Ticker.shared.count).toBe(before + 1);
    expect(() => Ticker.shared.update((now = 150))).not.toThrow();
    expect(onLanded).toHaveBeenCalledWith(expect.objectContaining({ landingKey: '1:1' }));

    now = 1000;
    Ticker.shared.update(now);
    await second;
    expect(onLanded).toHaveBeenCalledWith(expect.objectContaining({ landingKey: '2:1' }));
    expect(Ticker.shared.count).toBe(before);
    layer.destroy();
  });

  it('plays nothing once destroyed', async () => {
    const before = Ticker.shared.count;
    const { layer, onLanded } = layerWith();
    layer.destroy();

    await layer.play(request(1, flight(1)));

    expect(Ticker.shared.count).toBe(before);
    expect(onLanded).not.toHaveBeenCalled();
  });
});
