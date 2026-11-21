import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import { defaultFactory, contextFor } from '../../factory/factory-test-setup';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { rollFor } from './generator-test-setup';

const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);

describe('weapon crit generator audit', () => {
  it.each([1, 2, 3, 4] as const)(
    'tier %s raises only the maximum and keeps weapon-only pools',
    (tier) => {
      for (const type of EQUIPMENT_TYPES) {
        const values = { crit: new Set<number>(), 'crit-dmg': new Set<number>() };
        for (let seed = 0; seed < 1000; seed++) {
          for (const attribute of rollFor(generator, type, tier, seed)) {
            if (attribute.key !== 'crit' && attribute.key !== 'crit-dmg') continue;
            expect(type.group).toBe('weapon');
            values[attribute.key].add(attribute.value);
          }
        }
        if (type.group !== 'weapon') continue;
        const max = [2, 4, 6, 10][tier - 1];
        expect([...values.crit].sort((a, b) => a - b)).toEqual(
          Array.from({ length: max - 1 }, (_, i) => i + 2),
        );
        expect([...values['crit-dmg']].sort()).toEqual(
          tier === 1 ? [] : Array.from({ length: tier - 1 }, (_, i) => i + 3),
        );
      }
    },
  );

  it.each([1, 2, 3, 4] as const)('factory validates tier %s bounds including overrides', (tier) => {
    const ctx = contextFor(1, { type: 'sword', mapTier: tier });
    const max = [2, 4, 6, 10][tier - 1];
    for (const value of [2, max]) {
      expect(
        defaultFactory.createBase(ctx, { attributes: [{ key: 'crit', value }] }),
      ).toMatchObject({ ok: true });
    }
    for (const value of [1, max + 1]) {
      expect(
        defaultFactory.createBase(ctx, { attributes: [{ key: 'crit', value }] }),
      ).toMatchObject({ ok: false });
    }
    expect(
      defaultFactory.createBase(ctx, { attributes: [{ key: 'crit-dmg', value: tier + 1 }] }),
    ).toMatchObject({ ok: tier !== 1 });
  });

  it.each(['shield', 'sword', 'axe', 'pickaxe'])(
    'factory keeps both attributes limited to weapons: %s',
    (type) => {
      for (const key of ['crit', 'crit-dmg']) {
        expect(
          defaultFactory.createBase(contextFor(1, { type, mapTier: 4 }), {
            attributes: [{ key, value: key === 'crit' ? 10 : 5 }],
          }),
        ).toMatchObject({ ok: type !== 'shield' });
      }
    },
  );
});
