import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import {
  BATTLE_CREATURES,
  BATTLE_ITEMS,
  BATTLE_OBJECTS,
  battleItemOfHexobject,
  battleKindOfHexobject,
  behaviourOf,
  enemyCreature,
} from './battle-catalogue';
import { BATTLE_TERRAINS } from './battle-state';

describe('REQ-BTL-017 table rules', () => {
  const defs: { title: string; tableRule: string; id: string }[] = [
    ...Object.values(BATTLE_CREATURES),
    ...Object.values(BATTLE_ITEMS),
    ...Object.values(BATTLE_OBJECTS),
  ];

  it.each(defs.map((def) => [def.id, def.tableRule] as const))(
    '%s has a table rule',
    (id, tableRule) => {
      expect(tableRule).toBe(`content.battle.${id}.tableRule`);
    },
  );

  it('covers every battle terrain except plain floor, and the boulder', () => {
    const objects = Object.keys(BATTLE_OBJECTS).sort();
    expect(objects).toEqual([...BATTLE_TERRAINS.filter((t) => t !== 'floor'), 'boulder'].sort());
  });
});

describe('battle catalogue', () => {
  it('only puts known items into creature hands', () => {
    for (const creature of Object.values(BATTLE_CREATURES)) {
      for (const item of [creature.hands.right, creature.hands.left]) {
        if (item) expect(BATTLE_ITEMS[item], `${creature.id} holds ${item}`).toBeDefined();
      }
    }
  });

  it('builds an enemy from the pilot numbers', () => {
    expect(enemyCreature('skeleton-king', 'k', { q: 0, r: 0 })).toMatchObject({
      hp: 9,
      maxHp: 9,
      weight: 3,
      force: 2,
      hands: { right: { power: 1 }, left: { shieldCapacity: 2 } },
    });
    expect(enemyCreature('skeleton-archer', 'a', { q: 0, r: 0 }).hands.right).toEqual({
      key: 'bone-bow',
      power: 1,
      range: { min: 2, max: 3 },
    });
  });

  it('reads the old skeletor map token as a skeleton warrior, so old saves keep working', () => {
    expect(battleKindOfHexobject(HEXOBJECT_KEYS.SKELETOR)).toBe('skeleton-warrior');
    expect(battleItemOfHexobject(HEXOBJECT_KEYS.SWORD)).toBe('sword');
    expect(battleItemOfHexobject(HEXOBJECT_KEYS.SHIELD)).toBe('wooden-shield');
    expect(behaviourOf('unknown-kind')).toBe('warrior');
  });
});
