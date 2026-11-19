import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import {
  createEquipmentAttributeGenerator,
  seededRandomStreams,
} from '../tokens/equipment/generator';
import { ATTRIBUTE_PROFILES } from '../content/attribute-profiles.content';
import { createKnowledgeState } from './state';
import { syncEquipmentWill } from './equipment-will';

function jewel(type: string, value: number) {
  return {
    key: type,
    token: { ...upcastToken('hero', type, 'shield')!, type, attributes: [{ key: 'will', value }] },
  };
}

describe('A02 equipment Will stats', () => {
  it('raises the Will roll ceiling by 10 per source tier on every equipment type', () => {
    const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
    for (const type of EQUIPMENT_TYPES) {
      for (const level of [1, 2, 3, 4] as const) {
        const values = new Set<number>();
        let withoutWill = false;
        for (let seed = 0; seed < 1000; seed++) {
          const attributes = generator.generate({
            level,
            group: type.group,
            type,
            tokenId: `${type.key}:${seed}`,
            rng: seededRandomStreams(`seed:${seed}`),
          });
          const will = attributes.find((attribute) => attribute.key === 'will');
          if (will) values.add(will.value);
          else withoutWill = true;
        }
        expect(
          [...values].sort((a, b) => a - b),
          `${type.key} tier ${level}`,
        ).toEqual(Array.from({ length: level * 10 }, (_, index) => index + 1));
        expect(withoutWill).toBe(true);
      }
    }
  });

  it('EA-15: sums ring/amulet bases and attributes without a total cap', () => {
    expect(resolveHeroStats([jewel('ring', 2), jewel('amulet', 3)]).maxWill).toBe(8);
    const stats = resolveHeroStats([jewel('ring', 40), jewel('amulet', 40)]);
    expect(stats.maxWill).toBe(83);
    expect(syncEquipmentWill(createKnowledgeState('hero'), stats).knowledge).toMatchObject({
      capacity: 133,
      current: 50,
    });
  });

  it('EA-16: the live registry rolls will for jewelry and deprecated owned attributes still work', () => {
    const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
    const type = EQUIPMENT_TYPES.find((entry) => entry.key === 'ring')!;
    let seen = false;
    for (let seed = 0; seed < 100; seed++) {
      const attributes = generator.generate({
        level: 4,
        group: type.group,
        type,
        tokenId: `ring:${seed}`,
        rng: seededRandomStreams(`seed:${seed}`),
      });
      seen ||= attributes.some((attribute) => attribute.key === 'will');
    }
    expect(seen).toBe(true);
    const attributes = EQUIPMENT_ATTRIBUTES.map((entry) =>
      entry.key === 'will' ? { ...entry, deprecated: true } : entry,
    );
    expect(
      resolveHeroStats([jewel('ring', 4)], { attributes, types: EQUIPMENT_TYPES }).maxWill,
    ).toBe(5);
  });

  it('does not mutate a knowledge state or bump its revision when capacity already matches', () => {
    const state = createKnowledgeState('hero');
    expect(syncEquipmentWill(state, { maxWill: 0 })).toEqual({ knowledge: state, events: [] });
    expect(syncEquipmentWill(state, { maxWill: 0 }).knowledge).toBe(state);
  });
});
