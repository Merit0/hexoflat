import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { TRADER_KEYS, TRADERS } from './traders.content';
import { traderFailures, traderProblems, validateContent } from './validate-content';

const ilva = TRADERS.ilva;

function variant(change: Record<string, unknown>) {
  return { ...structuredClone(ilva), ...change };
}

describe('TRADERS content', () => {
  it('passes validation as written', () => {
    expect(traderFailures(TRADERS)).toEqual([]);
    expect(() => validateContent()).not.toThrow();
  });

  it('lists ilva as the only trader for now', () => {
    expect(TRADER_KEYS).toEqual(['ilva']);
  });

  it('sells at 2/5 of the price in whole numbers and fills one row of seven goods', () => {
    expect(ilva.sellRate).toEqual({ num: 2, den: 5 });
    expect(ilva.goodsSlots).toBe(8);
    expect(ilva.guaranteed.length + ilva.rolls).toBe(ilva.goodsSlots);
  });

  it('starts the goods refresh at 20 Will and doubles it', () => {
    expect(ilva.refresh).toEqual({ baseWill: 20, factor: 2 });
  });

  it('stands at the trader stall', () => {
    expect(ilva.stallHexobjectKey).toBe(HEXOBJECT_KEYS.TRADER_STALL);
  });
});

describe('traderProblems', () => {
  it('refuses a sell rate that is not a fraction below one', () => {
    expect(traderProblems('ilva', variant({ sellRate: { num: 5, den: 5 } }))).toContain(
      'sellRate must be below 1',
    );
    expect(traderProblems('ilva', variant({ sellRate: { num: 0.4, den: 1 } }))).not.toEqual([]);
    expect(traderProblems('ilva', variant({ sellRate: { num: 0, den: 5 } }))).not.toEqual([]);
  });

  it('refuses more goods than the row holds', () => {
    expect(traderProblems('ilva', variant({ rolls: 8 }))).toContain(
      'guaranteed + rolls exceed goodsSlots',
    );
  });

  it('refuses more rolls than distinct pool keys', () => {
    expect(traderProblems('ilva', variant({ pool: ilva.pool.slice(0, 2) }))).toContain(
      'rolls exceed the distinct pool keys',
    );
  });

  it('refuses goods without a coin price', () => {
    const pool = [...ilva.pool, { key: HEXOBJECT_KEYS.COINS, weight: 1, min: 1, max: 1 }];
    expect(traderProblems('ilva', variant({ pool }))).toContain('coins has no coinPrice');
  });

  it('refuses a range that is upside down or above the stack size', () => {
    const upsideDown = [{ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, min: 3, max: 2 }];
    expect(traderProblems('ilva', variant({ guaranteed: upsideDown }))).toContain(
      'health-bottle min is above max',
    );
    const twoAxes = ilva.pool.map((entry) =>
      entry.key === HEXOBJECT_KEYS.AXE ? { ...entry, max: 2 } : entry,
    );
    expect(traderProblems('ilva', variant({ pool: twoAxes }))).toContain(
      'axe max is above its stack',
    );
    const elevenBottles = [{ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, min: 1, max: 11 }];
    expect(traderProblems('ilva', variant({ guaranteed: elevenBottles }))).toContain(
      'health-bottle max is above its stack',
    );
  });

  it('refuses the same key twice', () => {
    const pool = [...ilva.pool, { key: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 1, min: 1, max: 1 }];
    expect(traderProblems('ilva', variant({ pool }))).toContain('health-bottle is listed twice');
  });

  it('refuses a key that differs from its record, unknown fields and unknown items', () => {
    expect(traderProblems('other', ilva)).toContain('key "ilva" differs from its record');
    expect(traderProblems('ilva', variant({ discount: 1 }))).not.toEqual([]);
    const pool = [...ilva.pool, { key: 'dragon-egg', weight: 1, min: 1, max: 1 }];
    expect(traderProblems('ilva', variant({ pool }))).not.toEqual([]);
  });
});
