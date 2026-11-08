import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readInventoryAggregate } from '@/services/inventory/stash-transfer';
import { resetStashDrag, stashDrag, stashFx } from './stash-drag-state';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { stashErrorText } from './stash-messages';
import { closeStashBoard } from './use-stash-board';
import { dragBegin, dragCancel, dragMoveTo, dragRelease, quickMove } from './use-stash-drag';

const bag = (index: number): TItemLocation => ({ container: 'bag', index });
const stash = (index: number): TItemLocation => ({ container: 'stash', index });
const equip = (slot: 'weapon' | 'armor'): TItemLocation => ({ container: 'equip', slot });
const cellTarget = (at: TItemLocation) => ({ kind: 'cell', at }) as const;

function setup() {
  setActivePinia(createPinia());
  localStorage.clear();
  resetStashDrag();
  useHeroToolStore().clearActionMessage();
  stashFx.landed = null;
  stashFx.shake = null;
  stashFx.blinkWeight = false;
  const inventory = useHeroInventoryStore();
  const stashStore = useHeroStashStore();
  inventory.hydrate();
  inventory.carryCapacityKg = 10;
  stashStore.setChests(1);
  stashStore.open();
  return { inventory, stashStore };
}

function put(key: string, amount = 1) {
  const inventory = useHeroInventoryStore();
  inventory.putToInventory(key as never, amount);
  const index = readInventoryAggregate().bag.findIndex((item) => item?.key === key);
  return { index, item: readInventoryAggregate().bag[index] as InventoryItem };
}

const POINT = { x: 10, y: 10, offsetX: 5, offsetY: 5, width: 60, height: 60 };

function lift(from: TItemLocation, item: InventoryItem, split = false) {
  dragBegin(from, item, POINT, split);
}

describe('stash drag controller', () => {
  beforeEach(setup);

  it('lifts an item and points at the first free cell on the other side', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    expect(stashDrag.active).toBe(true);
    expect(stashDrag.nextHint).toEqual({ container: 'stash', index: 0 });
  });

  it('plans a drop only when the target changes', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    dragMoveTo(cellTarget(stash(4)));
    const first = stashDrag.preview;
    dragMoveTo(cellTarget(stash(4)));
    expect(stashDrag.preview).toBe(first);
    dragMoveTo(cellTarget(stash(5)));
    expect(stashDrag.preview).not.toBe(first);
  });

  it('moves the item to the cell it is released over and marks the landing', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    dragMoveTo(cellTarget(stash(4)));
    dragRelease();
    expect(useHeroStashStore().cells[4]?.id).toBe(item.id);
    expect(stashFx.landed).toBe('stash:4');
    expect(stashDrag.active).toBe(false);
    expect(useHeroToolStore().actionMessage).toBeNull();
  });

  it('sends the item to the nearest free cell when released over the pane', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    dragMoveTo({ kind: 'zone', container: 'stash' });
    dragRelease();
    expect(useHeroStashStore().cells[0]?.id).toBe(item.id);
  });

  it('refuses a wrong slot with a message, a shake, and leaves everything in place', () => {
    const { index, item } = put(K.SHIELD);
    lift(bag(index), item);
    dragMoveTo(cellTarget(equip('weapon')));
    expect(stashDrag.preview).toMatchObject({ ok: false, reason: 'WRONG_SLOT' });
    dragRelease();
    expect(useHeroToolStore().actionMessage).toBeTruthy();
    expect(stashFx.shake).toBe('equip:weapon');
    expect(readInventoryAggregate().bag[index]?.id).toBe(item.id);
  });

  it('blinks the weight bar when the bag cannot carry the item', () => {
    const { inventory } = setup();
    const { index, item } = put(K.SHIELD);
    dragBegin(bag(index), item, POINT, false);
    dragMoveTo({ kind: 'zone', container: 'stash' });
    dragRelease();
    inventory.carryCapacityKg = inventory.carriedWeightKg + 0.5;
    lift(stash(0), useHeroStashStore().cells[0]!);
    dragMoveTo({ kind: 'zone', container: 'bag' });
    dragRelease();
    expect(stashFx.blinkWeight).toBe(true);
    expect(useHeroToolStore().actionMessage).toBe(stashErrorText('OVERWEIGHT'));
    expect(useHeroStashStore().cells[0]?.key).toBe(K.SHIELD);
  });

  it('cancels without touching anything', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    dragMoveTo(cellTarget(stash(1)));
    dragCancel();
    expect(stashDrag.active).toBe(false);
    expect(useHeroStashStore().usedCount).toBe(0);
  });

  it('ignores a release that is not over any place', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    dragMoveTo(null);
    dragRelease();
    expect(useHeroStashStore().usedCount).toBe(0);
    expect(useHeroToolStore().actionMessage).toBeNull();
  });

  it('splits half a stack when the split key was held', () => {
    const { index, item } = put(K.HEALTH_BOTTLE, 7);
    lift(bag(index), item, true);
    dragMoveTo(cellTarget(stash(2)));
    expect(stashDrag.preview).toMatchObject({ ok: true, kind: 'split', moved: 3 });
    dragRelease();
    expect(useHeroStashStore().cells[2]?.amount).toBe(3);
    expect(readInventoryAggregate().bag[index]?.amount).toBe(4);
  });

  it('is cancelled when the stash closes mid-drag', () => {
    const { index, item } = put(K.SWORD);
    lift(bag(index), item);
    closeStashBoard();
    expect(stashDrag.active).toBe(false);
  });
});

describe('quickMove (double click, right click, Enter)', () => {
  beforeEach(setup);

  it('stores a bag item and says so', () => {
    const { index } = put(K.COINS, 5);
    quickMove(bag(index));
    expect(useHeroStashStore().usedCount).toBe(1);
    expect(useHeroToolStore().actionMessage).toBeNull();
  });

  it('takes a stash item back to the bag', () => {
    const { index } = put(K.COINS, 5);
    quickMove(bag(index));
    quickMove(stash(0));
    expect(useHeroStashStore().usedCount).toBe(0);
    expect(readInventoryAggregate().bag.some((item) => item?.key === K.COINS)).toBe(true);
  });

  it('sends a worn item to the stash', () => {
    const { index } = put(K.AXE);
    dragBegin(bag(index), readInventoryAggregate().bag[index]!, POINT, false);
    dragMoveTo(cellTarget(equip('weapon')));
    dragRelease();
    quickMove(equip('weapon'));
    expect(useHeroStashStore().cells.some((cell) => cell?.key === K.AXE)).toBe(true);
  });

  it('half a stack goes across with the split key', () => {
    const { index } = put(K.HEALTH_BOTTLE, 6);
    quickMove(bag(index), true);
    expect(useHeroStashStore().cells[0]?.amount).toBe(3);
  });

  it('reports a refusal instead of failing silently', () => {
    const { stashStore } = setup();
    stashStore.close();
    const { index } = put(K.SWORD);
    quickMove(bag(index));
    expect(useHeroToolStore().actionMessage).toBeTruthy();
    expect(stashFx.shake).toBe(`bag:${index}`);
  });
});
