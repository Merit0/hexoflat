import { describe, expect, it } from 'vitest';
import { applySacrifice, getSacrificeAmount, getSacrificeOptions } from './sacrifice-rules';

describe('getSacrificeOptions', () => {
  it('offers 30%, 60% and everything held, scaled by capacity', () => {
    expect(getSacrificeOptions(100, 100).map((o) => o.amount)).toEqual([30, 60, 100]);
    expect(getSacrificeOptions(50, 50).map((o) => o.amount)).toEqual([15, 30, 50]);
  });

  it('rounds up without floating-point drift', () => {
    expect(getSacrificeOptions(137, 137).map((o) => o.amount)).toEqual([42, 83, 137]);
    expect(getSacrificeOptions(10, 10).map((o) => o.amount)).toEqual([3, 6, 10]);
  });

  it('marks an option affordable only when the hero holds that much', () => {
    expect(getSacrificeOptions(100, 45).map((o) => o.affordable)).toEqual([true, false, true]);
    expect(getSacrificeOptions(100, 0).map((o) => o.affordable)).toEqual([false, false, false]);
  });

  it('"all" sacrifices exactly what is held', () => {
    expect(getSacrificeAmount(100, 37, 'all')).toBe(37);
    expect(getSacrificeAmount(100, 37, 'medium')).toBeNull();
    expect(getSacrificeAmount(100, 37, 'small')).toBe(30);
  });
});

describe('applySacrifice', () => {
  it('fills the bar without raising the rank while the price is not met', () => {
    expect(applySacrifice({}, {}, 'a_teleport', 400)).toEqual({
      rank: 0,
      progress: 400,
      spent: 400,
      ranksGained: 0,
    });
  });

  it('adds to existing progress and rises a rank when the price is met', () => {
    const outcome = applySacrifice({}, { a_teleport: 400 }, 'a_teleport', 100);
    expect(outcome).toEqual({ rank: 1, progress: 0, spent: 100, ranksGained: 1 });
  });

  it('carries the overflow into the next rank, across several ranks', () => {
    const outcome = applySacrifice({}, {}, 'a_teleport', 500 + 1000 + 2000 + 30);
    expect(outcome).toEqual({ rank: 3, progress: 30, spent: 3530, ranksGained: 3 });
  });

  it('takes only what is needed at the top rank', () => {
    const outcome = applySacrifice({ b_strike: 9 }, { b_strike: 10 }, 'b_strike', 100);
    expect(outcome).toEqual({ rank: 10, progress: 0, spent: 8, ranksGained: 1 });
  });

  it('spends nothing on a maxed skill', () => {
    expect(applySacrifice({ b_strike: 10 }, {}, 'b_strike', 50).spent).toBe(0);
  });
});
