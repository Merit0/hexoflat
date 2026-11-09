import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { runWorldTick } from '@/stores/world-map-store-helpers';
import { useWorldMapStore } from '@/stores/world-map-store';
import {
  consumeItemFromStores,
  grantItemToStores,
  inventoryStateFromStores,
} from './inventory-bridge';

const HERO = 'hero-1';
const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  const inventory = useHeroInventoryStore();
  inventory.hydrate();
  return { inventory, ctx: useWorldMapStore().buildEngineContext() };
}

describe('inventory bridge: state from the stores', () => {
  beforeEach(() => setup());

  it('shows the same bag, hands and capacity as the store', () => {
    const { inventory } = setup();
    inventory.putToInventory(HEXOBJECT_KEYS.SWORD, 1);
    inventory.moveItemToSlot(
      inventory.items.find((i) => i.key === HEXOBJECT_KEYS.SWORD)!.id,
      'eq:weapon',
    );
    const state = inventoryStateFromStores(HERO);
    expect(state.equip.weapon?.key).toBe(HEXOBJECT_KEYS.SWORD);
    expect(state.equip.shield).toBeNull();
    expect(state.capacityKg).toBe(inventory.carryCapacityKg);
  });

  it('continues the id sequence of items it created earlier', () => {
    const { ctx } = setup();
    grantItemToStores(HERO, ctx, HEXOBJECT_KEYS.SWORD, 1, 'dev');
    grantItemToStores(HERO, ctx, HEXOBJECT_KEYS.AXE, 1, 'dev');
    const ids = useHeroInventoryStore().items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`${HERO}:0`);
    expect(ids).toContain(`${HERO}:1`);
  });
});

describe('inventory bridge: grant and consume', () => {
  it('grants into the store with isNew, a rotation and a saved copy', () => {
    const { inventory, ctx } = setup();
    const result = grantItemToStores(HERO, ctx, POTION, 2, 'pickup');
    expect(result.ok).toBe(true);
    const potion = inventory.items.find((i) => i.key === POTION)!;
    expect(potion).toMatchObject({ amount: 2, isNew: true });
    expect(inventory.rotationsById[potion.id]).toBeDefined();
    expect(
      (JSON.parse(localStorage.getItem('hexoflat.hero.inventory.v1')!) as { items: unknown[] })
        .items,
    ).toHaveLength(inventory.items.length);
  });

  it('tops up the existing stack and keeps the hands filled', () => {
    const { inventory, ctx } = setup();
    grantItemToStores(HERO, ctx, POTION, 1, 'pickup');
    grantItemToStores(HERO, ctx, POTION, 1, 'pickup');
    expect(inventory.items.filter((i) => i.key === POTION)).toHaveLength(1);
    expect(inventory.countItem(POTION)).toBe(2);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('answers with the legacy messages and changes nothing when it cannot', () => {
    const { inventory, ctx } = setup();
    inventory.carryCapacityKg = inventory.carriedWeightKg;
    const before = JSON.stringify(inventory.items);
    const heavy = grantItemToStores(HERO, ctx, HEXOBJECT_KEYS.SWORD, 1, 'pickup');
    expect(heavy.ok).toBe(false);
    expect(heavy.message).toMatch(/^Too heavy! Carry limit/);
    expect(JSON.stringify(inventory.items)).toBe(before);
  });

  it('consumes from a hand and refills it with the bare hand', () => {
    const { inventory, ctx } = setup();
    grantItemToStores(HERO, ctx, POTION, 1, 'pickup');
    inventory.moveItemToSlot(inventory.items.find((i) => i.key === POTION)!.id, 'eq:weapon');
    expect(consumeItemFromStores(HERO, ctx, POTION, 1).ok).toBe(true);
    expect(inventory.countItem(POTION)).toBe(0);
    expect(inventory.equippedItems.weapon?.key).toBe(HEXOBJECT_KEYS.HAND);
  });

  it('refuses to consume what the hero does not have', () => {
    const { inventory, ctx } = setup();
    const before = JSON.stringify(inventory.items);
    expect(consumeItemFromStores(HERO, ctx, POTION, 1).ok).toBe(false);
    expect(JSON.stringify(inventory.items)).toBe(before);
  });
});

describe('inventory bridge: picking up through the world tick', () => {
  it('moves the object from the map into the store', () => {
    const { inventory, ctx } = setup();
    const map = new HexMapBuilder().name('tick').width(2).height(2).build();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SWORD, tile.coordinates);
    tile.pendingAction = {
      type: EHexActionType.TAKE,
      startedAt: 0,
      endsAt: 0,
      hexobjectKey: HEXOBJECT_KEYS.SWORD,
    };
    runWorldTick(map, 10, ctx, HERO);
    expect(tile.hexobject).toBeNull();
    expect(inventory.items.some((i) => i.key === HEXOBJECT_KEYS.SWORD)).toBe(true);
  });

  it('leaves the object on the map when the bag cannot carry it', () => {
    const { inventory, ctx } = setup();
    inventory.carryCapacityKg = inventory.carriedWeightKg;
    const map = new HexMapBuilder().name('tick').width(2).height(2).build();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SWORD, tile.coordinates);
    tile.pendingAction = {
      type: EHexActionType.TAKE,
      startedAt: 0,
      endsAt: 0,
      hexobjectKey: HEXOBJECT_KEYS.SWORD,
    };
    runWorldTick(map, 10, ctx, HERO);
    expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.SWORD);
    expect(inventory.items.some((i) => i.key === HEXOBJECT_KEYS.SWORD)).toBe(false);
  });
});
