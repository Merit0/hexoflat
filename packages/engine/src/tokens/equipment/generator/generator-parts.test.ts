import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../../content/attribute-profiles.content';
import { ATTRIBUTE_STREAM_LABELS } from './attribute-streams';
import { WeightedCountRoller } from './count-roller';
import { createEquipmentAttributeGenerator } from './create-equipment-attribute-generator';
import { FIXTURE_ATTRIBUTES, fixtureAttribute, typeOf } from './generator-test-setup';
import { RegistryAttributePoolFilter } from './pool-filter';
import { ContentAttributeProfileProvider } from './profile-provider';
import { SteppedValueRoller } from './value-roller';
import { CumulativeWeightedPicker } from './weighted-picker';

const fixed = (value: number) => () => value;

describe('EA2 generator parts', () => {
  it('the value roller stays on the step grid and inside the range', () => {
    const roller = new SteppedValueRoller();
    const range = { min: 3, max: 9, step: 3 };
    expect(roller.roll(range, fixed(0))).toBe(3);
    expect(roller.roll(range, fixed(0.5))).toBe(6);
    expect(roller.roll(range, fixed(0.999999))).toBe(9);
  });

  it('the count roller clamps the roll to the pool and maxCount', () => {
    const counts = new WeightedCountRoller(new CumulativeWeightedPicker());
    const request = { countWeights: [0, 0, 100], maxCount: 2 };
    expect(counts.roll({ ...request, poolSize: 5 }, fixed(0.5))).toBe(2);
    expect(counts.roll({ ...request, poolSize: 1 }, fixed(0.5))).toBe(1);
    expect(counts.roll({ ...request, poolSize: 0 }, fixed(0.5))).toBe(0);
  });

  it('the pool filter refuses a duplicate attribute key', () => {
    const twice = fixtureAttribute('twice', { groups: ['weapon'], stat: 'critPoints' });
    expect(() => new RegistryAttributePoolFilter([twice, twice])).toThrow(/DUPLICATE_ATTRIBUTE/);
  });

  it('the pool needs a group weight in the profile', () => {
    const pool = new RegistryAttributePoolFilter(FIXTURE_ATTRIBUTES);
    const profile = new ContentAttributeProfileProvider(ATTRIBUTE_PROFILES).profileFor(1);
    expect(
      pool.poolFor({ profile, group: 'weapon', type: typeOf('sword') }).map((e) => e.key),
    ).toEqual(['crit-chance', 'trophy', 'will']);
    expect(
      pool.poolFor({ profile, group: 'weapon', type: typeOf('axe') }).map((e) => e.key),
    ).toEqual(['will', 'yield']);
  });

  it('an empty pool stops the generator without an error', () => {
    const generator = createEquipmentAttributeGenerator([], ATTRIBUTE_PROFILES);
    const ctx = {
      level: 4,
      group: 'weapon',
      type: typeOf('sword'),
      tokenId: 'test:sword:0',
    } as const;
    expect(generator.generate({ ...ctx, rng: () => fixed(0) })).toEqual([]);
  });

  it('asks for one named stream per step', () => {
    const labels: string[] = [];
    const generator = createEquipmentAttributeGenerator(FIXTURE_ATTRIBUTES, ATTRIBUTE_PROFILES);
    const attributes = generator.generate({
      level: 4,
      group: 'weapon',
      type: typeOf('sword'),
      tokenId: 'test:sword:7',
      rng: (label) => {
        labels.push(label);
        return fixed(0.99);
      },
    });
    expect(attributes).toHaveLength(2);
    expect(labels).toEqual([
      ATTRIBUTE_STREAM_LABELS.count('test:sword:7'),
      ATTRIBUTE_STREAM_LABELS.pick('test:sword:7', 0),
      ATTRIBUTE_STREAM_LABELS.value('test:sword:7', attributes[0].key),
      ATTRIBUTE_STREAM_LABELS.pick('test:sword:7', 1),
      ATTRIBUTE_STREAM_LABELS.value('test:sword:7', attributes[1].key),
    ]);
    expect(labels[0]).toBe('token:test:sword:7:attr:count');
  });
});
