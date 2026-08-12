import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import {
  applyBlock,
  calculateEnemyRawDamage,
  calculateHeroRawDamage,
  getAttackMultiplier,
  getMarkerDefense,
} from './damage-calculator';

describe('applyBlock', () => {
  it('subtracts the block from the raw hit', () => {
    expect(applyBlock(8, 3)).toBe(5);
  });

  it('never returns negative damage when the block outweighs the hit', () => {
    expect(applyBlock(2, 5)).toBe(0);
  });

  it('passes the hit through untouched when there is no block', () => {
    expect(applyBlock(7.5, 0)).toBe(7.5);
  });

  it('rounds to a single decimal, so damage never shows floating-point noise', () => {
    expect(applyBlock(0.3, 0.1)).toBe(0.2);
  });
});

describe('calculateHeroRawDamage', () => {
  it('scales the hero attack by the weapon multiplier', () => {
    const multiplier = getAttackMultiplier(HEXOBJECT_KEYS.SWORD);

    expect(calculateHeroRawDamage(10, HEXOBJECT_KEYS.SWORD)).toBe(
      Number((10 * multiplier).toFixed(1)),
    );
  });

  it('leaves the attack unscaled when the tool is not a weapon', () => {
    expect(calculateHeroRawDamage(10, HEXOBJECT_KEYS.HAND)).toBe(
      Number((10 * getAttackMultiplier(HEXOBJECT_KEYS.HAND)).toFixed(1)),
    );
  });

  it('never drops to zero, so a weak swing still registers as a hit', () => {
    expect(calculateHeroRawDamage(0, HEXOBJECT_KEYS.SWORD)).toBe(0.1);
  });
});

describe('calculateEnemyRawDamage', () => {
  it('uses the creature attack when it has one', () => {
    expect(calculateEnemyRawDamage(4)).toBe(4);
  });

  it('falls back to 1 for a creature with no attack stat', () => {
    expect(calculateEnemyRawDamage(null)).toBe(1);
    expect(calculateEnemyRawDamage(undefined)).toBe(1);
  });
});

describe('getMarkerDefense', () => {
  it('reports a shield’s defence', () => {
    expect(getMarkerDefense(HEXOBJECT_KEYS.SHIELD)).toBeGreaterThan(0);
  });

  it('is zero when no tool backs the marker', () => {
    expect(getMarkerDefense(null)).toBe(0);
    expect(getMarkerDefense(undefined)).toBe(0);
  });
});
