import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocationRespawn,
  consumeDueLocationRespawn,
  getLocationRespawnRemainingMs,
  isLocationRespawning,
  scheduleLocationRespawn,
} from './respawn-schedule';

// No Pinia: the respawn clock is schedule bookkeeping, not map state.

describe('respawn-schedule', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a freshly scheduled location as respawning', () => {
    scheduleLocationRespawn('camping', 60_000);

    expect(isLocationRespawning('camping')).toBe(true);
    expect(getLocationRespawnRemainingMs('camping')).toBe(60_000);
  });

  it('counts the remaining time down as the clock advances', () => {
    scheduleLocationRespawn('camping', 60_000);

    vi.advanceTimersByTime(20_000);

    expect(getLocationRespawnRemainingMs('camping')).toBe(40_000);
  });

  it('never reports negative remaining time once the timer has passed', () => {
    scheduleLocationRespawn('camping', 1_000);

    vi.advanceTimersByTime(5_000);

    expect(getLocationRespawnRemainingMs('camping')).toBe(0);
    expect(isLocationRespawning('camping')).toBe(false);
  });

  it('treats an unscheduled location as not respawning', () => {
    expect(getLocationRespawnRemainingMs('camping')).toBe(0);
    expect(isLocationRespawning('camping')).toBe(false);
  });

  it('clearLocationRespawn cancels a pending timer', () => {
    scheduleLocationRespawn('camping', 60_000);

    clearLocationRespawn('camping');

    expect(isLocationRespawning('camping')).toBe(false);
  });

  it('clearLocationRespawn on an unscheduled location is a no-op', () => {
    expect(() => clearLocationRespawn('camping')).not.toThrow();
    expect(isLocationRespawning('camping')).toBe(false);
  });

  it('keeps separate locations on independent timers', () => {
    scheduleLocationRespawn('camping', 60_000);
    scheduleLocationRespawn('cave', 10_000);

    vi.advanceTimersByTime(20_000);

    expect(isLocationRespawning('camping')).toBe(true);
    expect(isLocationRespawning('cave')).toBe(false);
  });

  describe('consumeDueLocationRespawn', () => {
    it('does not fire before the timer is due, and leaves it pending', () => {
      scheduleLocationRespawn('camping', 60_000);

      expect(consumeDueLocationRespawn('camping')).toBe(false);
      expect(isLocationRespawning('camping')).toBe(true);
    });

    it('fires once the timer is due and drops it from the schedule', () => {
      scheduleLocationRespawn('camping', 1_000);
      vi.advanceTimersByTime(1_000);

      expect(consumeDueLocationRespawn('camping')).toBe(true);
      expect(consumeDueLocationRespawn('camping')).toBe(false);
    });

    it('returns false for a location that was never scheduled', () => {
      expect(consumeDueLocationRespawn('camping')).toBe(false);
    });
  });
});
