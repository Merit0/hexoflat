import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor, typeOf } from './generator-test-setup';
import { defaultFactory, contextFor } from '../../factory/factory-test-setup';

describe('A08 Yield generator audit', () => {
  const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);

  it.each([1, 2, 3, 4] as const)('tier %s rolls Yield only for TOOL items', (tier) => {
    const max = tier < 3 ? 1 : 2;
    expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes.yield).toMatchObject({
      min: 1,
      max,
      step: 1,
    });
    for (const type of EQUIPMENT_TYPES) {
      const values = new Set<number>();
      let absent = false;
      for (let seed = 0; seed < 500; seed++) {
        const bonus = rollFor(generator, type, tier, seed).find(
          (attribute) => attribute.key === 'yield',
        );
        if (!type.tool) expect(bonus).toBeUndefined();
        else if (bonus) values.add(bonus.value);
        else absent = true;
      }
      if (type.tool) {
        expect([...values].sort()).toEqual(max === 1 ? [1] : [1, 2]);
        expect(absent).toBe(true);
      }
    }
  });

  it('excludes deprecated Yield from the real pool', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((definition) =>
      definition.key === 'yield' ? { ...definition, deprecated: true } : definition,
    );
    const deprecated = createEquipmentAttributeGenerator(attributes, ATTRIBUTE_PROFILES);
    for (let seed = 0; seed < 500; seed++) {
      expect(
        rollFor(deprecated, typeOf('axe'), 4, seed).some((attribute) => attribute.key === 'yield'),
      ).toBe(false);
    }
  });

  it.each(['sword', 'shield'])('the factory refuses Yield overrides on non-TOOL %s', (type) => {
    expect(
      defaultFactory.createBase(contextFor(1, { type, mapTier: 3 }), {
        attributes: [{ key: 'yield', value: 1 }],
      }),
    ).toMatchObject({ ok: false });
  });
});
