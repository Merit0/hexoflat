import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor, typeOf } from './generator-test-setup';
import { defaultFactory, contextFor } from '../../factory/factory-test-setup';
import { resolveItemStats } from '../item-stats';
import { sampleToken } from '../../token-test-setup';

describe('Heal on Block generator audit', () => {
  const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
  it.each([1, 2, 3, 4] as const)('tier %s raises only the maximum healing on shields', (tier) => {
    expect(ATTRIBUTE_PROFILES[`tier-${tier}`].attributes['heal-on-block']).toMatchObject({
      min: 1,
      max: tier,
      step: 1,
    });
    for (const type of EQUIPMENT_TYPES) {
      const values = new Set<number>();
      let absent = false;
      for (let seed = 0; seed < 500; seed++) {
        const attributes = rollFor(generator, type, tier, seed);
        expect(attributes.some((attribute) => attribute.key === 'thorns')).toBe(false);
        const bonus = attributes.find((attribute) => attribute.key === 'heal-on-block');
        if (type.key !== 'shield') expect(bonus).toBeUndefined();
        else if (bonus) values.add(bonus.value);
        else absent = true;
      }
      if (type.key === 'shield') {
        expect([...values].sort()).toEqual(Array.from({ length: tier }, (_, i) => i + 1));
        expect(absent).toBe(true);
      }
    }
  });
  it.each(['sword', 'axe', 'pickaxe'])('refuses factory overrides on %s', (type) => {
    expect(
      defaultFactory.createBase(contextFor(1, { type, mapTier: 4 }), {
        attributes: [{ key: 'heal-on-block', value: 4 }],
      }),
    ).toMatchObject({ ok: false });
  });
  it('keeps deprecated owned healing while removing it from the pool', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((attribute) =>
      attribute.key === 'heal-on-block' ? { ...attribute, deprecated: true } : attribute,
    );
    const deprecated = createEquipmentAttributeGenerator(attributes, ATTRIBUTE_PROFILES);
    for (let seed = 0; seed < 500; seed++)
      expect(
        rollFor(deprecated, typeOf('shield'), 4, seed).some(
          (attribute) => attribute.key === 'heal-on-block',
        ),
      ).toBe(false);
    expect(
      resolveItemStats(
        { key: 'shield', token: sampleToken({ attributes: [{ key: 'heal-on-block', value: 4 }] }) },
        attributes,
      ).healOnBlock,
    ).toBe(4);
  });
});
