import { describe, expect, it } from 'vitest';
import { AttributeRegistry } from '../../registries';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../../content/item-types.content';
import {
  FIXTURE_ATTRIBUTES,
  FIXTURE_PROFILES,
  GENERATED_GROUPS,
  TIERS,
  fixtureAttribute,
  fixtureGenerator,
  rollFor,
  seeds,
  typeOf,
  typesOf,
  withProfileRow,
} from './generator-test-setup';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';

const byKey = new Map(FIXTURE_ATTRIBUTES.map((attribute) => [attribute.key, attribute]));
const generator = fixtureGenerator();

describe('EA-1: generated attributes stay inside the profile', () => {
  for (const tier of TIERS) {
    for (const group of GENERATED_GROUPS) {
      it(`tier-${tier} ${group}: count, keys and values follow the profile`, () => {
        const profile = FIXTURE_PROFILES[`tier-${tier}`];
        for (const type of typesOf(group)) {
          for (const seed of seeds()) {
            const attributes = rollFor(generator, type, tier, seed);
            expect(attributes.length).toBeLessThanOrEqual(profile.maxCount);
            const keys = attributes.map((attribute) => attribute.key);
            expect(new Set(keys).size).toBe(keys.length);
            for (const { key, value } of attributes) {
              const definition = byKey.get(key);
              const row = profile.attributes[key];
              expect(definition?.implemented).toBe(true);
              expect(definition?.deprecated).not.toBe(true);
              expect(row).toBeDefined();
              expect(value).toBeGreaterThanOrEqual(row.min);
              expect(value).toBeLessThanOrEqual(row.max);
              expect((value - row.min) % row.step).toBe(0);
            }
          }
        }
      });
    }
  }
});

describe('EA-2: attribute count follows countWeights', () => {
  const samples = seeds(2000);
  for (const tier of TIERS) {
    it(`tier-${tier}: share of 0/1/2 attributes is within 5 points of countWeights`, () => {
      const sword = typeOf('sword');
      const histogram = [0, 0, 0];
      for (const seed of samples) histogram[rollFor(generator, sword, tier, seed).length] += 1;
      FIXTURE_PROFILES[`tier-${tier}`].countWeights.forEach((weight, count) => {
        expect(Math.abs((histogram[count] / samples.length) * 100 - weight)).toBeLessThanOrEqual(5);
      });
    });
  }
});

describe('EA-3: pool rules', () => {
  const allRolls = () =>
    EQUIPMENT_TYPES.flatMap((type) =>
      TIERS.flatMap((tier) =>
        seeds().map((seed) => ({ type, attributes: rollFor(generator, type, tier, seed) })),
      ),
    );
  const rolls = allRolls();

  it('yield appears only on types with a tool, and does appear on them', () => {
    const withYield = rolls.filter(({ attributes }) => attributes.some((a) => a.key === 'yield'));
    expect(withYield.length).toBeGreaterThan(0);
    for (const { type } of withYield) expect(type.tool).not.toBeNull();
    expect(new Set(withYield.map(({ type }) => type.key))).toEqual(new Set(['axe', 'pickaxe']));
  });

  it('attributes with onlyTypes appear only on those types', () => {
    for (const { type, attributes } of rolls) {
      for (const { key } of attributes) {
        const onlyTypes = byKey.get(key)?.onlyTypes;
        if (onlyTypes) expect(onlyTypes).toContain(type.key);
      }
    }
  });

  it('attributes appear only on types of their groups', () => {
    for (const { type, attributes } of rolls) {
      for (const { key } of attributes) expect(byKey.get(key)?.groups).toContain(type.group);
    }
  });

  it('crit-dmg also appears without crit-chance on the same item', () => {
    const lone = rolls.filter(
      ({ attributes }) =>
        attributes.some((a) => a.key === 'crit-dmg') &&
        !attributes.some((a) => a.key === 'crit-chance'),
    );
    expect(lone.length).toBeGreaterThan(0);
  });

  it('a dependent attribute appears only together with its requirement', () => {
    const dependent = fixtureGenerator(
      FIXTURE_ATTRIBUTES.map((attribute) =>
        attribute.key === 'crit-dmg'
          ? { ...attribute, requires: { attributes: ['crit-chance'] } }
          : attribute,
      ),
    );
    const withDamage = typesOf('weapon')
      .flatMap((type) =>
        TIERS.flatMap((tier) =>
          seeds().map((seed) => rollFor(dependent, type, tier, seed).map((a) => a.key)),
        ),
      )
      .filter((keys) => keys.includes('crit-dmg'));
    expect(withDamage.length).toBeGreaterThan(0);
    for (const keys of withDamage) expect(keys).toContain('crit-chance');
  });
});

describe('EA-4: determinism', () => {
  it('the same seed and context give the same attributes', () => {
    const again = fixtureGenerator();
    for (const type of EQUIPMENT_TYPES) {
      for (const seed of seeds(50)) {
        expect(rollFor(again, type, 4, seed)).toEqual(rollFor(generator, type, 4, seed));
      }
    }
  });

  it('an attribute of another group changes nothing', () => {
    const extra = fixtureAttribute('lucky-charm', { groups: ['jewelry'], stat: 'maxWill' });
    const extended = createEquipmentAttributeGenerator(
      new AttributeRegistry([...FIXTURE_ATTRIBUTES, extra]),
      withProfileRow(FIXTURE_PROFILES, extra.key, {
        weight: { jewelry: 90 },
        min: 1,
        max: 3,
        step: 1,
      }),
    );
    for (const type of [...typesOf('weapon'), ...typesOf('defense'), ...typesOf('clothing')]) {
      for (const seed of seeds(100)) {
        expect(rollFor(extended, type, 3, seed)).toEqual(rollFor(generator, type, 3, seed));
      }
    }
  });

  it('a new attribute in the same group does not change the count stream', () => {
    const extra = fixtureAttribute('keen-edge', { groups: ['weapon'], stat: 'critPoints' });
    const extended = createEquipmentAttributeGenerator(
      new AttributeRegistry([...FIXTURE_ATTRIBUTES, extra]),
      withProfileRow(FIXTURE_PROFILES, extra.key, {
        weight: { weapon: 500 },
        min: 1,
        max: 1,
        step: 1,
      }),
    );
    const sword = typeOf('sword');
    let changed = 0;
    for (const seed of seeds()) {
      const before = rollFor(generator, sword, 4, seed);
      const after = rollFor(extended, sword, 4, seed);
      expect(after.length).toBe(before.length);
      if (after.some((attribute) => attribute.key === extra.key)) changed += 1;
    }
    expect(changed).toBeGreaterThan(0);
  });
});

describe('closed attributes are never generated', () => {
  const hidden = [
    fixtureAttribute('not-ready', { groups: ['weapon'], stat: 'critPoints', implemented: false }),
    fixtureAttribute('retired', { groups: ['weapon'], stat: 'critPoints', deprecated: true }),
  ];
  const profiles = hidden.reduce(
    (current, attribute) =>
      withProfileRow(current, attribute.key, {
        weight: { weapon: 1000 },
        min: 1,
        max: 1,
        step: 1,
      }),
    FIXTURE_PROFILES,
  );
  const closed = createEquipmentAttributeGenerator(
    new AttributeRegistry([...FIXTURE_ATTRIBUTES, ...hidden]),
    profiles,
  );

  it('an attribute with implemented false or deprecated true never appears in 500 seeds', () => {
    for (const type of typesOf('weapon')) {
      for (const tier of TIERS) {
        for (const seed of seeds()) {
          const keys = rollFor(closed, type, tier, seed).map((attribute) => attribute.key);
          expect(keys).not.toContain('not-ready');
          expect(keys).not.toContain('retired');
        }
      }
    }
  });
});

describe('real content', () => {
  const real = createEquipmentAttributeGenerator(
    new AttributeRegistry(EQUIPMENT_ATTRIBUTES),
    ATTRIBUTE_PROFILES,
  );

  it('gives only implemented attributes for every group and tier', () => {
    for (const type of EQUIPMENT_TYPES) {
      for (const tier of TIERS) {
        for (const seed of seeds(100)) {
          for (const { key } of rollFor(real, type, tier, seed))
            expect([
              'crit-chance',
              'crit-dmg',
              'heart',
              'shield',
              'will',
              'fog',
              'trophy',
              'yield',
              'heal-on-block',
              'smart-step',
              'deft-hands',
              'wisdom',
            ]).toContain(key);
        }
      }
    }
  });
});
