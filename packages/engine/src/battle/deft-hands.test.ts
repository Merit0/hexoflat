import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { ATTRIBUTE_PROFILES } from '../content/attribute-profiles.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { createEquipmentAttributeGenerator } from '../tokens/equipment/generator';
import { rollFor, typeOf } from '../tokens/equipment/generator/generator-test-setup';
import { battleStateSchema } from './battle-state';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { usePriceFor } from '../inventory/use-price';
import { battleHeroStats } from './hero-stats';
import { rejectionOf } from './battle-test-setup';
import { describe, expect, it } from 'vitest';
import { battleItem } from './battle-catalogue';
import { battleWith, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';

function withPotion() {
  return giveTurn(
    battleWith([
      hero({ q: 0, r: 0 }, { hp: 3, hands: { right: battleItem('health-potion'), left: null } }),
      skeleton('s1', { q: 3, r: 0 }),
    ]),
    ['hero', 's1'],
  );
}

describe('A03 item USE characterization', () => {
  it('spends the base price, heals and consumes the potion without equipment', () => {
    const before = withPotion();
    const { battle, events } = heroDoes(before, { kind: 'use-item', hand: 'right' });
    expect(battle.turnWill).toBe(before.turnWill - 3);
    expect(events[0].payload).toMatchObject({ cost: 3, healed: 2 });
    expect(battle.creatures[0].hands.right).toBeNull();
    expect(before.creatures[0].hands.right).not.toBeNull();
  });
});

function gloves(value: number) {
  return {
    key: 'gloves',
    token: {
      ...upcastToken('hero', 'gloves', 'shield')!,
      type: 'gloves',
      baseKey: 'earth-gloves',
      name: { kind: 'noun' as const, noun: 'gloves' },
      attributes: [{ key: 'deft-hands', value }],
    },
  };
}

describe('A03 deft hands', () => {
  it.each([
    [1, 2],
    [2, 1],
    [9, 1],
  ])('equipment discount %s spends %s Will', (discount, cost) => {
    const before = withPotion();
    before.creatures[0].equipment = [gloves(discount)];
    before.turnWill = cost;
    const { battle, events } = heroDoes(before, { kind: 'use-item', hand: 'right' });
    expect(battle.turnWill).toBe(0);
    expect(events[0].payload).toMatchObject({ cost, healed: 2 });
    expect(battle.creatures[0].hands.right).toBeNull();
    expect(before.creatures[0].hands.right).not.toBeNull();
  });

  it('caps the summed discount at 2 and keeps a positive price at least 1', () => {
    const actor = withPotion().creatures[0];
    actor.equipment = [gloves(1), gloves(2)];
    const stats = battleHeroStats(actor);
    expect(stats.useWillDiscount).toBe(2);
    expect(usePriceFor({ usePrice: 1 }, stats)).toBe(1);
    expect(usePriceFor({}, stats)).toBe(0);
  });

  it('ignores bag attributes and refuses insufficient Will without consuming or healing', () => {
    const before = withPotion();
    before.creatures[0].bag = [{ ...battleItem('sword'), token: gloves(2).token }];
    expect(battleHeroStats(before.creatures[0]).useWillDiscount).toBe(0);
    before.creatures[0].equipment = [gloves(1)];
    before.turnWill = 1;
    const { battle, events } = heroDoes(before, { kind: 'use-item', hand: 'right' });
    expect(rejectionOf(events)).toBe('INSUFFICIENT_WILL');
    expect(battle.turnWill).toBe(1);
    expect(battle.creatures[0].hp).toBe(3);
    expect(battle.creatures[0].hands.right).not.toBeNull();
  });
});

describe('A03 EA-16 registry and saved battle', () => {
  it('rolls gloves with the live registry, retains deprecated attributes and restores USE behavior', () => {
    const generator = createEquipmentAttributeGenerator(EQUIPMENT_ATTRIBUTES, ATTRIBUTE_PROFILES);
    const rolls = Array.from({ length: 100 }, (_, seed) =>
      rollFor(generator, typeOf('gloves'), 4, seed),
    );
    const rolled = rolls.find((attributes) =>
      attributes.some((attribute) => attribute.key === 'deft-hands'),
    )!;
    expect(rolled).toBeDefined();
    const equipped = { ...gloves(1), token: { ...gloves(1).token, attributes: rolled } };
    const registry = {
      attributes: EQUIPMENT_ATTRIBUTES.map((entry) =>
        entry.key === 'deft-hands' ? { ...entry, deprecated: true } : entry,
      ),
      types: EQUIPMENT_TYPES,
    };
    expect(resolveHeroStats([equipped], registry).useWillDiscount).toBeGreaterThan(0);
    const before = withPotion();
    before.creatures[0].equipment = [equipped];
    const restored = battleStateSchema.parse(JSON.parse(JSON.stringify(before)));
    const cost = usePriceFor(
      restored.creatures[0].hands.right!,
      battleHeroStats(restored.creatures[0]),
    );
    expect(heroDoes(restored, { kind: 'use-item', hand: 'right' }).battle.turnWill).toBe(
      before.turnWill - cost,
    );
  });
});
