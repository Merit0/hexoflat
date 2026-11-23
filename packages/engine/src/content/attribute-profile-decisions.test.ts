import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILE_TIERS } from '../tokens/equipment/equipment-keys';
import { ATTRIBUTE_PROFILES } from './attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from './equipment-attributes.content';

describe('decided attribute ranges [min, max, step] per source tier', () => {
  it('holds the values Oleh decided for every rolled attribute', () => {
    const ranges = (key: string) =>
      ATTRIBUTE_PROFILE_TIERS.map((tier) => {
        const entry = ATTRIBUTE_PROFILES[tier].attributes[key];
        return entry ? [entry.min, entry.max, entry.step] : null;
      });
    const decided: Record<string, ([number, number, number] | null)[]> = {
      heart: [
        [1, 2, 1],
        [1, 4, 1],
        [1, 6, 1],
        [1, 8, 1],
      ],
      shield: [
        [1, 1, 1],
        [1, 2, 1],
        [1, 3, 1],
        [1, 4, 1],
      ],
      will: [
        [1, 10, 1],
        [1, 20, 1],
        [1, 30, 1],
        [1, 40, 1],
      ],
      fog: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
      ],
      crit: [
        [2, 2, 1],
        [2, 4, 1],
        [2, 6, 1],
        [2, 10, 1],
      ],
      'crit-dmg': [null, [3, 3, 1], [3, 4, 1], [3, 5, 1]],
      trophy: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
      ],
      yield: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
        [1, 2, 1],
      ],
      'heal-on-block': [
        [1, 1, 1],
        [1, 2, 1],
        [1, 3, 1],
        [1, 4, 1],
      ],
      'smart-step': [
        [5, 5, 1],
        [4, 5, 1],
        [3, 5, 1],
        [2, 5, 1],
      ],
      'deft-hands': [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
        [1, 2, 1],
      ],
      wisdom: [
        [1, 1, 1],
        [1, 2, 1],
        [1, 3, 1],
        [1, 4, 1],
      ],
    };
    const implemented = EQUIPMENT_ATTRIBUTES.filter(
      (attribute) => attribute.implemented && !attribute.deprecated,
    ).map((attribute) => attribute.key);
    expect(Object.keys(decided).sort()).toEqual([...implemented].sort());
    for (const [key, expected] of Object.entries(decided))
      expect(ranges(key), key).toEqual(expected);
  });
});
