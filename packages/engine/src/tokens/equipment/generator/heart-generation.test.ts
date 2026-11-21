import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { defaultFactory, contextFor } from '../../factory/factory-test-setup';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor } from './generator-test-setup';
import { resolveHeroStats } from '../hero-stats';

const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);

describe('Heart source-tier scaling', () => {
  it.each([1, 2, 3, 4] as const)(
    'tier %s preserves half a heart and raises the ceiling',
    (tier) => {
      expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes.heart).toMatchObject({
        min: 1,
        max: tier * 2,
        step: 1,
      });
      for (const type of EQUIPMENT_TYPES) {
        const values = new Set<number>();
        const allowed = type.group === 'defense' || type.group === 'clothing';
        for (let seed = 0; seed < 1000; seed++) {
          const heart = rollFor(generator, type, tier, seed).find(
            (attribute) => attribute.key === 'heart',
          );
          if (!allowed) expect(heart).toBeUndefined();
          else if (heart) values.add(heart.value);
        }
        if (allowed)
          expect([...values].sort((a, b) => a - b)).toEqual(
            Array.from({ length: tier * 2 }, (_, index) => index + 1),
          );
      }
    },
  );

  it.each([1, 2, 3, 4] as const)(
    'factory accepts both tier %s limits and rejects above them',
    (tier) => {
      const context = contextFor(1, { type: 'shield', mapTier: tier });
      for (const value of [1, tier * 2]) {
        const token = defaultFactory.createBase(context, { attributes: [{ key: 'heart', value }] });
        expect(token).toMatchObject({ ok: true });
        if (!token.ok) throw new Error(token.refusal.message);
        expect(resolveHeroStats([{ key: 'shield', token: token.value }]).maxHearts).toBe(value);
      }
      expect(
        defaultFactory.createBase(context, { attributes: [{ key: 'heart', value: tier * 2 + 1 }] }),
      ).toMatchObject({ ok: false });
    },
  );
});
