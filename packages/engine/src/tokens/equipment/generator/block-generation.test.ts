import { defaultFactory, contextFor } from '../../factory/factory-test-setup';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor, typeOf } from './generator-test-setup';
import { resolveHeroStats } from '../hero-stats';
import { sampleToken } from '../../token-test-setup';

describe('A10 Block generator audit', () => {
  const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
  it.each([1, 2, 3, 4] as const)('tier %s rolls only on shields', (tier) => {
    const max = tier === 4 ? 2 : 1;
    expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes.shield).toMatchObject({
      min: 1,
      max,
      step: 1,
    });
    for (const type of EQUIPMENT_TYPES) {
      const values = new Set<number>();
      let absent = false;
      for (let seed = 0; seed < 500; seed++) {
        const bonus = rollFor(generator, type, tier, seed).find(
          (attribute) => attribute.key === 'shield',
        );
        if (type.key !== 'shield') expect(bonus).toBeUndefined();
        else if (bonus) values.add(bonus.value);
        else absent = true;
      }
      if (type.key === 'shield') {
        expect([...values].sort()).toEqual(max === 1 ? [1] : [1, 2]);
        expect(absent).toBe(true);
      }
    }
  });

  it.each(['sword', 'axe', 'pickaxe'])('refuses Block overrides on %s', (type) => {
    expect(
      defaultFactory.createBase(contextFor(1, { type, mapTier: 4 }), {
        attributes: [{ key: 'shield', value: 2 }],
      }),
    ).toMatchObject({ ok: false });
  });

  it('stops generating deprecated Block while owned tokens retain their effect', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((definition) =>
      definition.key === 'shield' ? { ...definition, deprecated: true } : definition,
    );
    const deprecated = createEquipmentAttributeGenerator(attributes, ATTRIBUTE_PROFILES);
    for (let seed = 0; seed < 500; seed++) {
      expect(
        rollFor(deprecated, typeOf('shield'), 4, seed).some(
          (attribute) => attribute.key === 'shield',
        ),
      ).toBe(false);
    }
    expect(
      resolveHeroStats(
        [
          {
            key: 'shield',
            token: sampleToken({
              type: 'shield',
              name: { kind: 'noun', noun: 'shield' },
              attributes: [{ key: 'shield', value: 2 }],
            }),
          },
        ],
        { attributes, types: EQUIPMENT_TYPES },
      ).blockSides,
    ).toBe(3);
  });
});
