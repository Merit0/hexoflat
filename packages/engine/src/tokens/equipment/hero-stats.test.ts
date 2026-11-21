import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../content/item-types.content';
import { upcastToken } from '../../inventory/upcast-item-tokens';
import type { TokenAttribute } from '../token-schema';
import { resolveHeroStats } from './hero-stats';
import {
  fixtureAttribute,
  fixtureGenerator,
  rollFor,
  typeOf,
  withProfileRow,
} from './generator/generator-test-setup';
import { ATTRIBUTE_PROFILES } from '../../content/attribute-profiles.content';

function cell(type: string, attributes: TokenAttribute[] = []) {
  return { key: type, token: { ...upcastToken('hero', 'bag.0', 'shield')!, type, attributes } };
}

describe('EA4 hero stats', () => {
  it('returns zero bonuses for empty slots and keeps token hearts separate from legacy prototypes', () => {
    expect(Object.values(resolveHeroStats([null, undefined])).every((value) => value === 0)).toBe(
      true,
    );
    expect(resolveHeroStats([{ key: 'shield' }]).maxHearts).toBe(2);
    expect(resolveHeroStats([cell('shield')]).maxHearts).toBe(0);
    expect(resolveHeroStats([cell('shield', [{ key: 'heart', value: 1 }])]).maxHearts).toBe(1);
  });

  it('EA-12: caps the sum from every equipped item at ten half-hearts', () => {
    const equipped = ['shield', 'sword', 'helm', 'armor'].map((type) =>
      cell(type, [{ key: 'heart', value: 4 }]),
    );
    expect(resolveHeroStats(equipped).maxHearts).toBe(10);
    expect(resolveHeroStats([...equipped].reverse())).toEqual(resolveHeroStats(equipped));
  });

  it('includes clothing bases once and reads already owned items even when their type is not generated', () => {
    expect(
      resolveHeroStats([cell('helm'), cell('armor'), cell('gloves'), cell('boots')]).maxHearts,
    ).toBe(5);
    expect(resolveHeroStats([cell('armor', [{ key: 'heart', value: 1 }])]).maxHearts).toBe(3);
  });

  it('keeps old token attributes on types that can no longer roll them', () => {
    expect(resolveHeroStats([cell('sword', [{ key: 'heart', value: 2 }])]).maxHearts).toBe(2);
  });

  it('ignores unknown, unimplemented and item-scoped attributes', () => {
    const attributes = [
      ...EQUIPMENT_ATTRIBUTES,
      {
        ...fixtureAttribute('item-heart', { groups: ['weapon'], stat: 'maxHearts' }),
        scope: 'item' as const,
      },
    ];
    const stats = resolveHeroStats(
      [
        cell('sword', [
          { key: 'unknown', value: 100 },
          { key: 'trade', value: 2 },
          { key: 'item-heart', value: 4 },
          { key: 'heal-on-block', value: 4 },
        ]),
      ],
      { attributes, types: EQUIPMENT_TYPES },
    );
    expect(stats.maxHearts).toBe(0);
    expect(stats.shopBuyDiscountPct).toBe(0);
    expect(stats.healOnBlock).toBe(0);
  });

  it('aggregates min and max without treating an absent contribution as zero', () => {
    const attributes = [
      {
        ...fixtureAttribute('step', { groups: ['clothing'], stat: 'stepFreeEvery' }),
        aggregate: 'min' as const,
      },
      {
        ...fixtureAttribute('absorb', { groups: ['clothing'], stat: 'absorb' }),
        aggregate: 'max' as const,
        cap: 1,
      },
    ];
    const stats = resolveHeroStats(
      [
        cell('boots', [
          { key: 'step', value: 5 },
          { key: 'absorb', value: 1 },
        ]),
        cell('gloves', [
          { key: 'step', value: 3 },
          { key: 'absorb', value: 1 },
        ]),
        cell('shield'),
      ],
      { attributes, types: EQUIPMENT_TYPES },
    );
    expect(stats.stepFreeEvery).toBe(3);
    expect(stats.absorb).toBe(1);
  });
});

describe('EA-16 hero stat registry contract', () => {
  it('a new attribute for maxHearts works through generation and resolution using only data', () => {
    const extra = fixtureAttribute('extra-heart', { groups: ['defense'], stat: 'maxHearts' });
    const attributes = [...EQUIPMENT_ATTRIBUTES, extra];
    const profiles = withProfileRow(ATTRIBUTE_PROFILES, extra.key, {
      weight: { defense: 100 },
      min: 2,
      max: 2,
      step: 1,
    });
    const generator = fixtureGenerator(attributes, profiles);
    let generated = false;
    for (let seed = 0; seed < 100; seed++) {
      const rolled = rollFor(generator, typeOf('shield'), 4, seed);
      generated ||= rolled.some((attribute) => attribute.key === extra.key);
      expect(
        resolveHeroStats([cell('shield', rolled)], { attributes, types: EQUIPMENT_TYPES })
          .maxHearts,
      ).toBe(
        Math.min(
          10,
          rolled
            .filter((attribute) => attribute.key === 'heart' || attribute.key === extra.key)
            .reduce((sum, attribute) => sum + attribute.value, 0),
        ),
      );
    }
    expect(generated).toBe(true);
    expect(
      resolveHeroStats([cell('shield', [{ key: extra.key, value: 20 }])], {
        attributes,
        types: EQUIPMENT_TYPES,
      }).maxHearts,
    ).toBe(10);
  });

  it('EA-16: deprecated attributes stop rolling but still contribute on existing tokens', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((attribute) => ({
      ...attribute,
      deprecated: true,
    }));
    const registry = { attributes, types: EQUIPMENT_TYPES };
    expect(rollFor(fixtureGenerator(attributes), typeOf('shield'), 4, 1)).toEqual([]);
    expect(
      resolveHeroStats([cell('shield', [{ key: 'heart', value: 2 }])], registry).maxHearts,
    ).toBe(2);
  });

  it('rejects conflicting aggregation rules for the same stat', () => {
    const extra = {
      ...fixtureAttribute('other-heart', { groups: ['defense'], stat: 'maxHearts' }),
      aggregate: 'max' as const,
    };
    expect(() =>
      resolveHeroStats([], {
        attributes: [...EQUIPMENT_ATTRIBUTES, extra],
        types: EQUIPMENT_TYPES,
      }),
    ).toThrow('same aggregate');
  });
});
