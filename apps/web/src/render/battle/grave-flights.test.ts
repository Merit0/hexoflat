import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Ticker } from 'pixi.js';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { createLootFlightLayer, type LootFlightLayer } from '@/render/layers/loot-flight-layer';
import { finishLootFlights, lootFlying } from '@/services/loot/loot-flight-state';
import { createGraveFlights } from './grave-flights';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

const OPENED = {
  type: 'CONTAINER_OPENED',
  payload: {
    actorId: 'hero',
    containerId: 'grave-1',
    kind: 'grave',
    hex: { q: 0, r: 0 },
    from: { q: 1, r: 0 },
    placed: [{ hex: { q: 0, r: 1 }, itemKey: HEXOBJECT_KEYS.SWORD, amount: 1 }],
    toBag: [],
    nothing: false,
  },
} as unknown as DomainEvent;

let now = 0;

describe('grave flights on the battle board', () => {
  beforeEach(() => {
    now = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    finishLootFlights();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('REQ-2: cancelling during a grave flight clears its timer and reports nothing later', async () => {
    const onBusy = vi.fn();
    const layer: LootFlightLayer = createLootFlightLayer({
      worldContainer: new Container(),
      getTileSize: () => ({ w: 60, h: 60 }),
      onLanded: vi.fn(),
    });
    const flights = createGraveFlights({
      offsetOf: ({ q, r }) => ({ columnIndex: q, rowIndex: r }),
      flightLayer: () => layer,
      onBusy,
    });
    flights.start([OPENED]);
    expect(lootFlying.value).toBe(true);
    onBusy.mockClear();

    layer.destroy();
    flights.cancel();
    now = 5_000;
    Ticker.shared.update(now);
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(0);
    expect(lootFlying.value).toBe(false);
    expect(onBusy).not.toHaveBeenCalled();
  });
});
