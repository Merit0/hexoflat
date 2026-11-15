import { describe, expect, it, vi } from 'vitest';
import type { LootTable } from '../loot/loot-table';

const swap = vi.hoisted(() => ({ table: null as LootTable | null }));

vi.mock('../content/loot-tables.content', async (importOriginal) => {
  const original = await importOriginal<typeof import('../content/loot-tables.content')>();
  return { ...original, lootTableOf: (id: string) => swap.table ?? original.lootTableOf(id) };
});

import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { actWorld } from '../world';
import {
  blockAround,
  chestScene,
  itemsAround,
  openAction,
  runOf,
  snapshotOf,
  tileOf,
} from './chest-test-setup';

const GUARANTEED: LootTable = {
  id: 'test-guaranteed',
  rolls: [1, 1],
  guaranteed: [{ itemKey: HEXOBJECT_KEYS.COINS, amount: [20, 20] }],
  entries: [{ itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 1, amount: [1, 1] }],
};

function crowded() {
  swap.table = GUARANTEED;
  const scene = chestScene();
  blockAround(scene.world, scene.chest, scene.entry, 0);
  return scene;
}

describe('a chest with no place around it and guaranteed drops', () => {
  it('REQ-LOOT-062: the guaranteed drops go into the bag, nothing lands on the map, the hero stands on the chest', () => {
    const { world, chest } = crowded();
    const outcome = actWorld(runOf(world), openAction(chest));
    if (!outcome.ok) throw new Error(outcome.code);
    expect(countItem(toAggregate(outcome.inventory), HEXOBJECT_KEYS.COINS)).toBe(20);
    expect(countItem(toAggregate(outcome.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(0);
    expect(itemsAround(outcome.world, chest)).toEqual([]);
    expect(outcome.world.heroCoordinates).toEqual(chest);
    expect(outcome.progress.knowledge.current).toBe(48);
    const opened = outcome.events.find((e) => e.type === 'CONTAINER_OPENED')!;
    expect(opened.payload).toMatchObject({
      placed: [],
      toBag: [{ itemKey: HEXOBJECT_KEYS.COINS, amount: 20 }],
    });
  });

  it('REQ-LOOT-063: a full bag refuses with BAG_FULL and changes nothing, then the freed bag gets the same list', () => {
    const { world, chest, entry } = crowded();
    const before = snapshotOf(world);
    const full = runOf(world, { inventory: fullBag(HEXOBJECT_KEYS.SWORD) });
    const refused = actWorld(full, openAction(chest));
    expect(refused).toMatchObject({ ok: false, code: 'ACTION_REJECTED' });
    expect(JSON.stringify(refused.ok ? [] : refused.events)).toContain('BAG_FULL');
    expect(snapshotOf(world)).toBe(before);
    expect(full.progress.knowledge.current).toBe(50);
    expect(full.inventory).toEqual(fullBag(HEXOBJECT_KEYS.SWORD));
    expect(world.heroCoordinates).toEqual(entry);
    expect(tileOf(world, chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST);

    const freed = actWorld(
      runOf(world, { inventory: emptyInventoryState('hero-1') }),
      openAction(chest),
    );
    if (!freed.ok) throw new Error(freed.code);
    expect(countItem(toAggregate(freed.inventory), HEXOBJECT_KEYS.COINS)).toBe(20);
  });
});
