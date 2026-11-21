import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor, typeOf } from './generator-test-setup';
import { resolveItemStats } from '../item-stats';
import { sampleToken } from '../../token-test-setup';

describe('A09 Trophy generator audit', () => {
  const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
  it.each([1, 2, 3, 4] as const)(
    'tier %s rolls only on weapons, independently of TOOL capability',
    (tier) => {
      const max = tier === 4 ? 2 : 1;
      expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes.trophy).toMatchObject({
        min: 1,
        max,
        step: 1,
      });
      for (const type of EQUIPMENT_TYPES) {
        const values = new Set<number>();
        let absent = false;
        for (let seed = 0; seed < 500; seed++) {
          const bonus = rollFor(generator, type, tier, seed).find(
            (attribute) => attribute.key === 'trophy',
          );
          if (type.group !== 'weapon') expect(bonus).toBeUndefined();
          else if (bonus) values.add(bonus.value);
          else absent = true;
        }
        if (type.group === 'weapon') {
          expect([...values].sort()).toEqual(max === 1 ? [1] : [1, 2]);
          expect(absent).toBe(true);
        }
      }
    },
  );

  it('stops generating deprecated Trophy while owned tokens retain their effect', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((definition) =>
      definition.key === 'trophy' ? { ...definition, deprecated: true } : definition,
    );
    const deprecated = createEquipmentAttributeGenerator(attributes, ATTRIBUTE_PROFILES);
    for (let seed = 0; seed < 500; seed++) {
      expect(
        rollFor(deprecated, typeOf('sword'), 4, seed).some(
          (attribute) => attribute.key === 'trophy',
        ),
      ).toBe(false);
    }
    expect(
      resolveItemStats(
        {
          key: 'sword',
          token: sampleToken({
            attributes: [{ key: 'trophy', value: 2 }],
          }),
        },
        attributes,
      ).graveLootBonus,
    ).toBe(2);
  });
});
