import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getHeartPoints, sumHeartPoints } from './heart-points';

describe('heart points', () => {
  it('gives the base shield one extra heart', () => {
    expect(getHeartPoints(HEXOBJECT_KEYS.SHIELD)).toBe(1);
  });

  it('gives nothing for items without the property, tools and nothing', () => {
    expect(getHeartPoints(HEXOBJECT_KEYS.SWORD)).toBe(0);
    expect(getHeartPoints(HEXOBJECT_KEYS.AXE)).toBe(0);
    expect(getHeartPoints(null)).toBe(0);
    expect(getHeartPoints(undefined)).toBe(0);
  });

  it('adds up everything worn', () => {
    expect(sumHeartPoints([HEXOBJECT_KEYS.SHIELD, HEXOBJECT_KEYS.SWORD, null])).toBe(1);
    expect(sumHeartPoints([HEXOBJECT_KEYS.SHIELD, HEXOBJECT_KEYS.SHIELD])).toBe(2);
    expect(sumHeartPoints([])).toBe(0);
  });
});
