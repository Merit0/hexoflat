import { describe, expect, it } from 'vitest';
import { upcastAggregate } from '../aggregates/registry';
import { CONTENT_VERSION } from '../content/content-version';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import type { InventoryState, InventoryStateItem } from './inventory-state';
import { inventoryV1Fixture, V1_HERO } from './inventory-v1-fixture';

function cellsOf(state: InventoryState): (InventoryStateItem | null)[] {
  return [...state.bag, ...Object.values(state.equip), ...state.stash.cells];
}

function itemsOf(state: InventoryState): InventoryStateItem[] {
  return cellsOf(state).filter((cell): cell is InventoryStateItem => cell !== null);
}

describe('characterization: a stored v1 inventory loads', () => {
  const stored = (): unknown => JSON.parse(JSON.stringify(inventoryV1Fixture()));

  it('keeps every item, key and place of the v1 document', () => {
    const before = inventoryV1Fixture();
    const loaded = upcastAggregate('inventory', 1, stored(), { heroId: V1_HERO });
    expect(itemsOf(loaded)).toHaveLength(6);
    expect(cellsOf(loaded).map((cell) => cell?.key ?? null)).toEqual(
      cellsOf(before).map((cell) => cell?.key ?? null),
    );
    expect(cellsOf(loaded).map((cell) => cell?.id ?? null)).toEqual(
      cellsOf(before).map((cell) => cell?.id ?? null),
    );
  });

  it('keeps the coin and potion stacks equal', () => {
    const loaded = upcastAggregate('inventory', 1, stored(), { heroId: V1_HERO });
    expect(loaded.bag[1]).toEqual(inventoryV1Fixture().bag[1]);
    expect(loaded.bag[2]).toEqual(inventoryV1Fixture().bag[2]);
  });

  it('keeps the revision, id sequence and opened chests', () => {
    const loaded = upcastAggregate('inventory', 1, stored(), { heroId: V1_HERO });
    expect(loaded).toMatchObject({ heroId: V1_HERO, revision: 7, idSeq: 6 });
    expect(loaded.stash.chests).toBe(1);
  });
});

describe('characterization: a world of the current content version loads', () => {
  it('round-trips a camp world through JSON', () => {
    const world = createServerWorld('camping', 'map-1', 'seed-1', V1_HERO);
    const raw: unknown = JSON.parse(JSON.stringify(serializeWorld(world)));
    expect((raw as { contentVersion: number }).contentVersion).toBe(CONTENT_VERSION);
    const loaded = deserializeWorld(raw, 0);
    expect(loaded.mapId).toBe('map-1');
    expect(loaded.heroCoordinates).toEqual(world.heroCoordinates);
  });
});
