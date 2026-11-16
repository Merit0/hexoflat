import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { LOOT_TIMING } from '@/render/loot-timing';
import {
  finishLootFlights,
  isLootFlightPending,
  lootFlightRequest,
  lootFlying,
  startLootFlights,
} from './loot-flight-state';

const PLAN = {
  flights: [
    {
      itemKey: HEXOBJECT_KEYS.SWORD,
      from: { columnIndex: 0, rowIndex: 0 },
      to: { columnIndex: 1, rowIndex: 0 },
      delayMs: 0,
      landingKey: '1:0',
    },
  ],
  flightMs: 400,
  accentMs: 100,
  totalMs: 600,
};

describe('loot flight state', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    finishLootFlights();
    vi.useRealTimers();
  });

  it('publishes a request and hides its landing stacks until finished', () => {
    startLootFlights(PLAN);

    expect(lootFlying.value).toBe(true);
    expect(isLootFlightPending('1:0')).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('ignores a finish for an older request id', () => {
    startLootFlights(PLAN);
    const first = lootFlightRequest.value!.id;
    startLootFlights(PLAN);

    finishLootFlights(first);

    expect(lootFlying.value).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('ends the flight by itself after the safety margin', () => {
    startLootFlights(PLAN);

    vi.advanceTimersByTime(PLAN.totalMs + LOOT_TIMING.safetyMs);

    expect(lootFlying.value).toBe(false);
    expect(isLootFlightPending('1:0')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
