import { beforeEach, describe, expect, it } from 'vitest';
import {
  clockOffsetMs,
  msUntilServerTime,
  observeServerClock,
  resetServerClock,
} from './battle-clock';

describe('battle clock', () => {
  beforeEach(() => resetServerClock());

  it('stores the offset of the server clock from a response (REQ-B4-CLK-001)', () => {
    observeServerClock(10_000 + 5_000, 10_000, 10_000);
    expect(clockOffsetMs()).toBe(5_000);
  });

  it('assumes the server stamped the answer half way through the round trip', () => {
    observeServerClock(1_100, 1_000, 1_200);
    expect(clockOffsetMs()).toBe(0);
  });

  it('keeps the measurement with the smallest round trip', () => {
    observeServerClock(5_050, 1_000, 1_100);
    const best = clockOffsetMs();
    observeServerClock(9_000, 2_000, 2_900);
    expect(clockOffsetMs()).toBe(best);
    observeServerClock(5_525, 3_000, 3_050);
    expect(clockOffsetMs()).toBe(5_525 - 3_025);
  });

  it('replaces a stale measurement even with a longer round trip', () => {
    observeServerClock(1_005, 1_000, 1_010);
    observeServerClock(9_000_000, 8_000_000, 8_000_800);
    expect(clockOffsetMs()).toBe(9_000_000 - 8_000_400);
  });

  it('counts a deadline in server time against the shifted clock', () => {
    const now = Date.now();
    observeServerClock(now + 60_000, now, now);
    const left = msUntilServerTime(now + 65_000);
    expect(left).toBeGreaterThan(4_000);
    expect(left).toBeLessThanOrEqual(5_000);
    expect(msUntilServerTime(now)).toBe(0);
  });
});
