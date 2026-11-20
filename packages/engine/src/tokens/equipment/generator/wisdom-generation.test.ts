import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { fixtureGenerator, rollFor, typeOf } from './generator-test-setup';

describe('Wisdom source-level ranges', () => {
  const generator = fixtureGenerator();
  const amulet = typeOf('amulet');

  it.each([1, 2, 3, 4] as const)(
    'tier %s raises only the maximum; every lower value can still roll',
    (tier) => {
      expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes.wisdom).toMatchObject({
        min: 1,
        max: tier,
        step: 1,
      });
      const values = new Set<number>();
      let withoutWisdom = false;
      for (let seed = 0; seed < 500; seed++) {
        const attributes = rollFor(generator, amulet, tier, seed);
        expect(attributes.some((attribute) => attribute.key === 'focus')).toBe(false);
        const wisdom = attributes.find((attribute) => attribute.key === 'wisdom');
        if (wisdom) values.add(wisdom.value);
        else withoutWisdom = true;
      }
      expect([...values].sort()).toEqual(Array.from({ length: tier }, (_, index) => index + 1));
      expect(withoutWisdom).toBe(true);
    },
  );
});
