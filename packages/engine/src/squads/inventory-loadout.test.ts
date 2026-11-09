import { describe, expect, it } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import type { InventoryState } from '../inventory/inventory-state';
import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { heroBattleCreature } from './squad-battle';
import { loadoutFromInventory } from './inventory-loadout';
import { HERO, eventTypes, hexAction, lifecycle, squadWorld } from './squad-test-setup';

const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };
const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;

function packedInventory(): InventoryState {
  const inv = emptyInventoryState(HERO);
  inv.equip.weapon = mintItem(inv, HEXOBJECT_KEYS.SWORD, 1);
  inv.equip.shield = mintItem(inv, HEXOBJECT_KEYS.SHIELD, 1);
  inv.bag[0] = mintItem(inv, POTION, 2);
  inv.bag[1] = mintItem(inv, HEXOBJECT_KEYS.AXE, 1);
  return inv;
}

function fight(inventory: InventoryState | undefined) {
  const state = squadWorld({
    squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: SQUAD_AT }],
    hero: HERO_AT,
  });
  state.inventory = inventory;
  hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
  const bare = heroBattleCreature({ id: HERO, hearts: 3, weapon: null, shield: null, bag: [] });
  lifecycle(state, { kind: 'start', heroes: [bare] });
  return state;
}

function end(state: ReturnType<typeof fight>, outcome: 'victory' | 'defeat') {
  const battle = state.battle!;
  battle.outcome = outcome;
  battle.phase = 'ended';
  return lifecycle(state, { kind: 'close' });
}

describe('loadoutFromInventory', () => {
  it('reads the hands and up to three battle items from the bag, a stack counting per piece', () => {
    const loadout = loadoutFromInventory(packedInventory(), 3, 4);
    expect(loadout).toMatchObject({
      id: HERO,
      hearts: 3,
      maxHearts: 4,
      weapon: HEXOBJECT_KEYS.SWORD,
      shield: HEXOBJECT_KEYS.SHIELD,
      bag: [POTION, POTION],
    });
  });

  it('gives empty hands for an empty inventory and ignores items with no battle form', () => {
    const inv = emptyInventoryState(HERO);
    inv.equip.weapon = mintItem(inv, HEXOBJECT_KEYS.AXE, 1);
    expect(loadoutFromInventory(inv, 3)).toMatchObject({ weapon: null, shield: null, bag: [] });
  });

  it('caps the bag at three pieces', () => {
    const inv = emptyInventoryState(HERO);
    inv.bag[0] = mintItem(inv, POTION, 9);
    expect(loadoutFromInventory(inv, 3).bag).toHaveLength(3);
  });
});

describe('a battle starts from the inventory in the state', () => {
  it('puts the weapon, shield and potions of the inventory into the hero, whatever the web sent', () => {
    const state = fight(packedInventory());
    const me = state.battle!.creatures.find((c) => c.id === HERO)!;
    expect(me.hands.right?.key).toBe('sword');
    expect(me.hands.left?.key).toBe('wooden-shield');
    expect(me.bag.map((item) => item.key)).toEqual(['health-potion', 'health-potion']);
    expect(me.hp).toBe(6);
  });

  it('keeps the creature as the web sent it when the state has no inventory', () => {
    const state = fight(undefined);
    const me = state.battle!.creatures.find((c) => c.id === HERO)!;
    expect(me.hands.right).toBeNull();
    expect(me.bag).toEqual([]);
  });
});

describe('closing a battle spends what was used', () => {
  it('takes the drunk potion out of the inventory and reports it', () => {
    const state = fight(packedInventory());
    const me = state.battle!.creatures.find((c) => c.id === HERO)!;
    me.bag = me.bag.slice(1);
    const events = end(state, 'victory');
    expect(eventTypes(events)).toEqual([
      'SQUAD_DEFEATED',
      'BATTLE_CLOSED',
      'ITEM_CONSUMED',
      'INVENTORY_CHANGED',
    ]);
    expect(countItem(toAggregate(state.inventory!), POTION)).toBe(1);
    expect(state.inventory!.revision).toBe(1);
  });

  it('leaves the inventory alone when nothing was used', () => {
    const inventory = packedInventory();
    const state = fight(inventory);
    const events = end(state, 'defeat');
    expect(eventTypes(events)).toEqual(['BATTLE_CLOSED']);
    expect(state.inventory).toEqual(inventory);
  });
});
