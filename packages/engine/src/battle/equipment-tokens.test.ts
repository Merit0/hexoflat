import { describe, expect, it } from 'vitest';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { loadoutFromInventory } from '../squads/inventory-loadout';
import { heroBattleCreature } from '../squads/squad-battle';
import { syncHandsToInventory, restoreHandTokens } from '../world/battle-hands-sync';
import { battleItem } from './battle-catalogue';
import { battleStateSchema } from './battle-state';
import { battleHeroStats } from './hero-stats';
import { battleWith, giveTurn, heroDoes, skeleton } from './battle-test-setup';

function equipped() {
  const inventory = emptyInventoryState('hero');
  const item = mintItem(inventory, 'sword', 1);
  inventory.equip.weapon = { ...item, token: upcastToken('hero', 'equip.weapon', 'sword')! };
  inventory.equip.shield = {
    ...mintItem(inventory, 'shield', 1),
    token: {
      ...upcastToken('hero', 'equip.shield', 'shield')!,
      attributes: [{ key: 'heart', value: 3 }],
    },
  };
  return inventory;
}

describe('EA5 tokens in battle equipment', () => {
  it('carries owned tokens into battle, stats and saved snapshots without aliasing inventory', () => {
    const inventory = equipped();
    const loadout = loadoutFromInventory(inventory, 3, 4.5);
    const creature = heroBattleCreature(loadout);
    const state = battleWith([creature, skeleton('s1', { q: 2, r: 0 })]);
    const restored = battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const fighter = restored.creatures[0];
    expect(fighter.hands.right?.token).toEqual(inventory.equip.weapon?.token);
    expect(fighter.hands.left?.token).toEqual(inventory.equip.shield?.token);
    expect(battleHeroStats(fighter).maxHearts).toBe(3);
    expect(fighter.maxHp).toBe(9);
    expect(fighter.hands.left?.shieldCapacity).toBe(1);
    expect(fighter.hands.right?.power).toBe(2);
    loadout.shield!.token!.attributes[0].value = 9;
    expect(inventory.equip.shield?.token?.attributes[0].value).toBe(3);
    expect(creature.hands.left?.token?.attributes[0].value).toBe(3);
  });

  it('preserves tokens when swapping hands in either direction and stowing them', () => {
    const inventory = equipped();
    const creature = heroBattleCreature(loadoutFromInventory(inventory, 3));
    const state = giveTurn(battleWith([creature, skeleton('s1', { q: 3, r: 0 })]), ['hero', 's1']);
    const { battle } = heroDoes(state, {
      kind: 'set-hands',
      right: 'wooden-shield',
      left: 'sword',
    });
    expect(battle.creatures[0].hands.right?.token).toEqual(creature.hands.left?.token);
    expect(battle.creatures[0].hands.left?.token).toEqual(creature.hands.right?.token);
    expect(battle.creatures[0].bag).toEqual([]);
    const synced = syncHandsToInventory(inventory, creature, battle.creatures[0])!;
    expect(synced.equip.weapon?.token).toEqual(inventory.equip.shield?.token);
    expect(synced.equip.shield?.token).toEqual(inventory.equip.weapon?.token);
    expect(synced.revision).toBe(inventory.revision + 1);
  });

  it('replaces a held token with another of the same type and synchronizes inventory', () => {
    const inventory = equipped();
    const incoming = {
      ...mintItem(inventory, 'shield', 1),
      token: {
        ...upcastToken('hero', 'bag.0', 'shield')!,
        attributes: [{ key: 'deft-hands', value: 2 }],
      },
    };
    inventory.bag[0] = incoming;
    const creature = heroBattleCreature(loadoutFromInventory(inventory, 3));
    const state = giveTurn(battleWith([creature, skeleton('s1', { q: 3, r: 0 })]), ['hero', 's1']);
    const action = {
      kind: 'set-hands' as const,
      right: 'sword',
      left: 'wooden-shield',
      tokenIds: { right: creature.hands.right!.token!.id, left: incoming.token.id },
    };
    const { battle } = heroDoes(state, action);
    expect(battle.creatures[0].hands.left?.token?.id).toBe(incoming.token.id);
    expect(battle.turnWill).toBe(state.turnWill - 4);
    const synced = syncHandsToInventory(inventory, creature, battle.creatures[0])!;
    expect(synced.equip.shield?.token?.id).toBe(incoming.token.id);
    expect(synced.bag.some((item) => item?.token?.id === inventory.equip.shield?.token?.id)).toBe(
      true,
    );
  });

  it('rejects an unowned requested token without spending Will or replacing equipment', () => {
    const creature = heroBattleCreature(loadoutFromInventory(equipped(), 3));
    const state = giveTurn(battleWith([creature, skeleton('s1', { q: 3, r: 0 })]), ['hero', 's1']);
    const { battle, events } = heroDoes(state, {
      kind: 'set-hands',
      right: 'sword',
      left: 'wooden-shield',
      tokenIds: { right: creature.hands.right!.token!.id, left: 'not-owned' },
    });
    expect(events[0].type).toBe('BATTLE_REJECTED');
    expect(battle.turnWill).toBe(state.turnWill);
    expect(battle.creatures[0].hands).toEqual(creature.hands);
  });

  it('selects the same token in inventory even when two swords have the same battle key', () => {
    const inventory = equipped();
    inventory.equip.weapon = null;
    const first = {
      ...mintItem(inventory, 'sword', 1),
      token: upcastToken('hero', 'bag.0', 'sword')!,
    };
    const second = {
      ...mintItem(inventory, 'sword', 1),
      token: upcastToken('hero', 'bag.1', 'sword')!,
    };
    inventory.bag[0] = first;
    inventory.bag[1] = second;
    const before = heroBattleCreature(loadoutFromInventory(inventory, 3));
    const after = structuredClone(before);
    after.hands.right = { ...battleItem('sword'), token: second.token };
    const synced = syncHandsToInventory(inventory, before, after)!;
    expect(synced.equip.weapon?.token?.id).toBe(second.token.id);
    expect(synced.bag[0]?.token?.id).toBe(first.token.id);
    expect(synced.bag[1]).toBeNull();
    delete after.hands.right.token;
    restoreHandTokens(after, synced);
    expect(after.hands.right.token).toEqual(second.token);
  });

  it('accepts old tokenless battle snapshots and still resolves legacy gear', () => {
    const creature = heroBattleCreature({
      id: 'hero',
      hearts: 3,
      weapon: { key: 'sword' },
      shield: { key: 'shield' },
      bag: [],
    });
    const state = battleStateSchema.parse(
      JSON.parse(JSON.stringify(battleWith([creature, skeleton('s1', { q: 2, r: 0 })]))),
    );
    expect(state.creatures[0].equipment).toBeUndefined();
    expect(state.creatures[0].hands.right?.token).toBeUndefined();
    expect(state.creatures[0].hands.right?.power).toBe(2);
  });
});
