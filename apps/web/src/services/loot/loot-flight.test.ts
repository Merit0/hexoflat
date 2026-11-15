import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOOT_TIMING, lootSchedule } from '@/render/loot-timing';
import { BATTLE_TIMING } from '@/render/battle/battle-timing';
import { axialToOffset, offsetToAxial } from '@hexoflat/engine/utils/hex-utils';
import { containerOpenedOf, graveWalkLeadMs, planLootFlights } from './loot-flight';
import {
  finishLootFlights,
  isLootFlightPending,
  lootFlightRequest,
  lootFlying,
  startLootFlights,
} from './loot-flight-state';

const CHEST = { columnIndex: 4, rowIndex: 4 };
const opened = {
  type: 'CONTAINER_OPENED',
  payload: {
    actorId: 'h',
    containerId: '4:4',
    kind: 'chest',
    hex: offsetToAxial(CHEST),
    from: offsetToAxial({ columnIndex: 3, rowIndex: 4 }),
    nothing: false,
    placed: [
      { hex: offsetToAxial({ columnIndex: 5, rowIndex: 4 }), itemKey: 'coins', amount: 7 },
      { hex: offsetToAxial({ columnIndex: 4, rowIndex: 3 }), itemKey: 'health-bottle', amount: 1 },
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
  it('reads CONTAINER_OPENED and ignores other events', () => {
    expect(containerOpenedOf([{ type: 'WORLD_TICKED', payload: {} }], axialToOffset)).toBeNull();
    expect(containerOpenedOf([opened], axialToOffset)?.placed).toHaveLength(2);
  });

  it('flies placed items in array order from the chest centre, bag items to the hero', () => {
    const plan = planLootFlights(containerOpenedOf([opened], axialToOffset)!);
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
    startLootFlights(planLootFlights(containerOpenedOf([opened], axialToOffset)!));
    expect(lootFlying.value).toBe(true);
    expect(isLootFlightPending('5:4')).toBe(true);
    const id = lootFlightRequest.value!.id;
    finishLootFlights(id);
    expect(lootFlying.value).toBe(false);
    expect(isLootFlightPending('5:4')).toBe(false);
  });

  it('plays nothing under reduced motion: state is already final', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    startLootFlights(planLootFlights(containerOpenedOf([opened], axialToOffset)!));
    expect(lootFlying.value).toBe(false);
    vi.unstubAllGlobals();
  });

  it('lets go by itself when nobody draws the flight', () => {
    vi.useFakeTimers();
    startLootFlights(planLootFlights(containerOpenedOf([opened], axialToOffset)!));
    vi.advanceTimersByTime(LOOT_TIMING.maxTotalMs + LOOT_TIMING.safetyMs + 10);
    expect(lootFlying.value).toBe(false);
  });
});

describe('containerOpenedOf', () => {
  const same = (hex: { q: number; r: number }) => ({ columnIndex: hex.q, rowIndex: hex.r });
  const payload = (kind: string, extra: Record<string, unknown> = {}) => ({
    type: 'CONTAINER_OPENED',
    payload: {
      actorId: 'a',
      containerId: 'c',
      kind,
      hex: { q: 2, r: 1 },
      from: { q: 3, r: 1 },
      nothing: false,
      placed: [{ hex: { q: 3, r: 1 }, itemKey: 'coins', amount: 9 }],
      toBag: [],
      ...extra,
    },
  });

  it('world chest: axial hexes become board offsets', () => {
    const read = containerOpenedOf([opened], axialToOffset)!;
    expect(read.coordinates).toEqual(CHEST);
    expect(read.placed.map((item) => item.coordinates)).toEqual([
      { columnIndex: 5, rowIndex: 4 },
      { columnIndex: 4, rowIndex: 3 },
    ]);
  });

  it('grave: the battle converter is used as given, and the flight starts at the grave hex', () => {
    const read = containerOpenedOf([payload('grave')], same)!;
    expect(read.coordinates).toEqual({ columnIndex: 2, rowIndex: 1 });
    const plan = planLootFlights(read);
    expect(plan.flights).toHaveLength(1);
    expect(plan.totalMs).toBeLessThanOrEqual(800);
  });

  it('quest chest: placed and toBag are both kept, with quantities', () => {
    const read = containerOpenedOf(
      [payload('quest-chest', { toBag: [{ itemKey: 'sword', amount: 2 }] })],
      same,
    )!;
    expect(read.placed).toEqual([
      { coordinates: { columnIndex: 3, rowIndex: 1 }, itemKey: 'coins', amount: 9 },
    ]);
    expect(read.toBag).toEqual([{ itemKey: 'sword', amount: 2 }]);
  });

  it('nothing: true plays no flight', () => {
    const read = containerOpenedOf([payload('grave', { nothing: true, placed: [] })], same)!;
    expect(planLootFlights(read).flights).toEqual([]);
  });

  it('a journal event with a removed name is ignored, not thrown on', () => {
    const old = [
      { type: 'CHEST_OPENED', payload: { heroId: 'h', coordinates: CHEST } },
      { type: 'GRAVE_LOOTED', payload: {} },
    ];
    expect(() => containerOpenedOf(old, axialToOffset)).not.toThrow();
    expect(containerOpenedOf(old, axialToOffset)).toBeNull();
    expect(graveWalkLeadMs(old, 190)).toBe(0);
  });
});

describe('the walk onto a grave comes before the loot flies out', () => {
  const grave = { q: 1, r: 0 };
  const event = (payload: Record<string, unknown>) => ({
    type: 'CONTAINER_OPENED',
    payload: { actorId: 'hero', hex: grave, ...payload },
  });

  it('leads by one step when the hero moves onto the grave, and not at all when he stays', () => {
    expect(graveWalkLeadMs([event({ from: { q: 2, r: 0 } })], BATTLE_TIMING.stepMs)).toBe(
      BATTLE_TIMING.stepMs,
    );
    expect(graveWalkLeadMs([event({ from: { q: 2, r: 0 }, nothing: true })], 190)).toBe(0);
    expect(graveWalkLeadMs([], 190)).toBe(0);
  });

  it.each([1, 3, 6])('keeps walk plus %i flights inside the 800 ms budget', (count) => {
    const schedule = lootSchedule(count, BATTLE_TIMING.stepMs);
    expect(Math.min(...schedule.delaysMs)).toBeGreaterThanOrEqual(BATTLE_TIMING.stepMs);
    expect(schedule.totalMs).toBeLessThanOrEqual(LOOT_TIMING.maxTotalMs);
  });
});
