import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getShieldPoints, HERO_SHIELD_SLOTS, sumShieldPoints } from './shield-points';

describe('shield points', () => {
  it('gives the base shield one shield', () => {
    expect(getShieldPoints(HEXOBJECT_KEYS.SHIELD)).toBe(1);
  });

  it('gives nothing for items without the property, tools and nothing', () => {
    expect(getShieldPoints(HEXOBJECT_KEYS.SWORD)).toBe(0);
    expect(getShieldPoints(HEXOBJECT_KEYS.AXE)).toBe(0);
    expect(getShieldPoints(HEXOBJECT_KEYS.COINS)).toBe(0);
    expect(getShieldPoints(null)).toBe(0);
    expect(getShieldPoints(undefined)).toBe(0);
  });

  it('adds up everything worn and caps at the slot count', () => {
    expect(sumShieldPoints([HEXOBJECT_KEYS.SHIELD, HEXOBJECT_KEYS.SWORD, null])).toBe(1);
    expect(sumShieldPoints([])).toBe(0);
    const many = Array.from({ length: 10 }, () => HEXOBJECT_KEYS.SHIELD);
    expect(sumShieldPoints(many)).toBe(HERO_SHIELD_SLOTS);
  });
});
