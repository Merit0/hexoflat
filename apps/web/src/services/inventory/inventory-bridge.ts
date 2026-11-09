import { applyCommand, type HexEngineActionContext, type HexEngineState } from '@hexoflat/engine';
import { EQUIP_SLOTS } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { BAG_SLOT_KEYS } from '@hexoflat/engine/inventory/bag-layout';
import { migrateLegacyInventory } from '@hexoflat/engine/inventory/inventory-migration';
import type {
  InventoryState,
  InventoryStateItem,
} from '@hexoflat/engine/inventory/inventory-state';
import type { GrantItemCommand } from '@hexoflat/engine/inventory/inventory-commands';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';

/**
 * Temporary bridge (migration plan I3, removed in I4): the stores still hold the hero's bag, so
 * before an engine command that touches the inventory the state is rebuilt from them, and a
 * changed result is written back. Only the bag and the hands are written back; the stash is
 * read for a complete state but no command in this bridge changes it.
 */

const FALLBACK_HERO_ID = 'hero';

function ownerOf(heroId: string): string {
  return heroId || FALLBACK_HERO_ID;
}

function nextIdSeq(heroId: string, items: readonly InventoryItem[]): number {
  const prefix = `${heroId}:`;
  const used = items
    .filter((item) => item.id.startsWith(prefix))
    .map((item) => Number(item.id.slice(prefix.length)))
    .filter((n) => Number.isInteger(n) && n >= 0);
  return used.length ? Math.max(...used) + 1 : 0;
}

export function inventoryStateFromStores(rawHeroId: string): InventoryState {
  const heroId = ownerOf(rawHeroId);
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  inventory.hydrate();
  stash.hydrate();
  const { state } = migrateLegacyInventory(
    heroId,
    { items: inventory.items, carryCapacityKg: inventory.carryCapacityKg },
    { chests: stash.chests, starterGiven: stash.starterGiven, cells: stash.cells },
  );
  state.idSeq = nextIdSeq(heroId, inventory.items);
  return state;
}

function toStoreItem(
  cell: InventoryStateItem,
  slotKey: string,
  before: ReadonlyMap<string, InventoryItem>,
): InventoryItem {
  const previous = before.get(cell.id);
  const grew = !!previous && cell.amount > previous.amount;
  return { ...cell, slotKey, isNew: previous ? previous.isNew || grew : true };
}

export function writeInventoryToStores(state: InventoryState): void {
  const inventory = useHeroInventoryStore();
  const before = new Map(inventory.items.map((item) => [item.id, item]));
  const items: InventoryItem[] = [];
  state.bag.forEach((cell, index) => {
    if (cell) items.push(toStoreItem(cell, BAG_SLOT_KEYS[index], before));
  });
  for (const slot of EQUIP_SLOTS) {
    const cell = state.equip[slot];
    if (cell) items.push(toStoreItem(cell, `eq:${slot}`, before));
  }
  const kept = new Set(items.map((item) => item.id));
  for (const id of before.keys()) if (!kept.has(id)) delete inventory.rotationsById[id];
  inventory.items = items;
  for (const item of items) {
    const previous = before.get(item.id);
    if (!previous || previous.amount !== item.amount) inventory.rerollRotation(item.id);
    else inventory.ensureRotation(item.id);
  }
  if (inventory.selectedItemId && !kept.has(inventory.selectedItemId)) inventory.clearSelection();
  inventory.fillEmptySlotsWithHands();
  inventory.persist();
}

/**
 * Runs `run` on `state` with the hero's inventory filled from the stores, then writes the
 * inventory back when the command changed it.
 */
export function withStoreInventory<T>(
  heroId: string,
  state: HexEngineState,
  run: (state: HexEngineState) => T,
): T {
  const loaded = inventoryStateFromStores(heroId);
  state.inventory = loaded;
  const result = run(state);
  if (state.inventory && state.inventory !== loaded) writeInventoryToStores(state.inventory);
  return result;
}

export interface StockOutcome {
  ok: boolean;
  message?: string;
  events: DomainEvent[];
}

const GRANT_MESSAGES: Record<string, (capacityKg: number) => string> = {
  TOO_HEAVY: (capacityKg) => `Too heavy! Carry limit: ${capacityKg} kg`,
  BAG_FULL: () => 'Inventory is full!',
};

function emptyState(): HexEngineState {
  const map = new HexMapBuilder().name('inventory').width(1).height(1).build();
  return { map, heroes: {} };
}

export function grantItemToStores(
  rawHeroId: string,
  ctx: HexEngineActionContext,
  key: THexobjectKey,
  amount: number,
  source: GrantItemCommand['payload']['source'],
): StockOutcome {
  const heroId = ownerOf(rawHeroId);
  const state = emptyState();
  const events = withStoreInventory(heroId, state, (s) => {
    const revision = s.inventory?.revision ?? 0;
    return applyCommand(
      s,
      { type: 'GRANT_ITEM', payload: { heroId, revision, key, amount, source } },
      ctx,
    ).events;
  });
  const rejected = events.find((event) => event.type === 'ITEM_GRANT_REJECTED');
  if (!rejected) return { ok: true, events };
  const reason = (rejected.payload as { reason: string }).reason;
  const capacityKg = useHeroInventoryStore().carryCapacityKg;
  return { ok: false, message: GRANT_MESSAGES[reason]?.(capacityKg), events };
}

export function consumeItemFromStores(
  rawHeroId: string,
  ctx: HexEngineActionContext,
  key: THexobjectKey,
  amount: number,
): StockOutcome {
  const heroId = ownerOf(rawHeroId);
  const state = emptyState();
  const events = withStoreInventory(heroId, state, (s) => {
    const revision = s.inventory?.revision ?? 0;
    return applyCommand(
      s,
      { type: 'CONSUME_ITEM', payload: { heroId, revision, key, amount } },
      ctx,
    ).events;
  });
  return { ok: !events.some((event) => event.type === 'ITEM_CONSUME_REJECTED'), events };
}
