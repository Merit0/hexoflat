import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOOT_TIMING, lootSchedule } from '@/render/loot-timing';
import { chestOpenedOf, planLootFlights } from './loot-flight';
import {
  finishLootFlights,
  isLootFlightPending,
  lootFlightRequest,
  lootFlying,
  startLootFlights,
} from './loot-flight-state';

const CHEST = { columnIndex: 4, rowIndex: 4 };
const opened = {
  type: 'CHEST_OPENED',
  payload: {
    heroId: 'h',
    coordinates: CHEST,
    from: { columnIndex: 3, rowIndex: 4 },
    placed: [
      { coordinates: { columnIndex: 5, rowIndex: 4 }, itemKey: 'coins', amount: 7 },
      { coordinates: { columnIndex: 4, rowIndex: 3 }, itemKey: 'health-bottle', amount: 1 },
    ],
    toBag: [{ itemKey: 'sword', amount: 1 }],
  },
};

afterEach(() => {
  finishLootFlights();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('loot flight plan', () => {
  it('reads CHEST_OPENED and ignores other events', () => {
    expect(chestOpenedOf([{ type: 'WORLD_TICKED', payload: {} }])).toBeNull();
    expect(chestOpenedOf([opened])?.placed).toHaveLength(2);
  });

  it('flies placed items in array order from the chest centre, bag items to the hero', () => {
    const plan = planLootFlights(chestOpenedOf([opened])!);
    expect(plan.flights.map((flight) => flight.itemKey)).toEqual([
      'coins',
      'health-bottle',
      'sword',
    ]);
    expect(
      plan.flights.every((flight) => flight.from.rowIndex === 4 && flight.from.columnIndex === 4),
    ).toBe(true);
    expect(plan.flights[2].to).toBeNull();
    expect(plan.flights.map((flight) => flight.delayMs)).toEqual(
      [...plan.flights.map((flight) => flight.delayMs)].sort((a, b) => a - b),
    );
  });

  it('never takes longer than 800 ms, however many items fly', () => {
    for (let count = 1; count <= 12; count += 1) {
      const schedule = lootSchedule(count);
      expect(schedule.totalMs).toBeLessThanOrEqual(LOOT_TIMING.maxTotalMs);
      expect(schedule.delaysMs[count - 1] + schedule.flightMs).toBeLessThanOrEqual(
        LOOT_TIMING.maxTotalMs,
      );
    }
    expect(lootSchedule(0).totalMs).toBe(0);
  });
});

describe('loot flight state', () => {
  it('keeps the landing tile hidden and the board busy until the flight ends', () => {
    startLootFlights(planLootFlights(chestOpenedOf([opened])!));
    expect(lootFlying.value).toBe(true);
    expect(isLootFlightPending('5:4')).toBe(true);
    const id = lootFlightRequest.value!.id;
    finishLootFlights(id);
    expect(lootFlying.value).toBe(false);
    expect(isLootFlightPending('5:4')).toBe(false);
  });

  it('plays nothing under reduced motion: state is already final', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    startLootFlights(planLootFlights(chestOpenedOf([opened])!));
    expect(lootFlying.value).toBe(false);
    vi.unstubAllGlobals();
  });

  it('lets go by itself when nobody draws the flight', () => {
    vi.useFakeTimers();
    startLootFlights(planLootFlights(chestOpenedOf([opened])!));
    vi.advanceTimersByTime(LOOT_TIMING.maxTotalMs + LOOT_TIMING.safetyMs + 10);
    expect(lootFlying.value).toBe(false);
  });
});
