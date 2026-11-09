import { EQUIP_SLOTS } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { HEX_ENGINE_COMMAND_SCHEMAS } from '@hexoflat/engine/commands/hex-engine-commands';
import type { HexEngineCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import { applyConsumeItem, applyGrantItem } from '@hexoflat/engine/inventory/apply-stock';
import { applyInventoryCommand } from '@hexoflat/engine/inventory/apply-inventory';
import { BAG_SLOT_KEYS } from '@hexoflat/engine/inventory/bag-layout';
import type { InventoryContext } from '@hexoflat/engine/inventory/inventory-commands';
import { migrateLegacyInventory } from '@hexoflat/engine/inventory/inventory-migration';
import type {
  InventoryState,
  InventoryStateItem,
} from '@hexoflat/engine/inventory/inventory-state';
import { patchInventoryRecord } from '@/services/persistence/inventory-record-storage';
import type { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import type { useHeroStashStore } from '@/stores/hero-stash-store';

export interface InventoryStores {
  inventory: ReturnType<typeof useHeroInventoryStore>;
  stash: ReturnType<typeof useHeroStashStore>;
}

export const LOCAL_HERO_ID = 'hero';

const STASH_PREFIX = 'stash:';

function nextIdSeq(heroId: string, items: readonly (InventoryItem | null)[]): number {
  const prefix = `${heroId}:`;
  const used = items
    .flatMap((item) => (item?.id.startsWith(prefix) ? [Number(item.id.slice(prefix.length))] : []))
    .filter((n) => Number.isInteger(n) && n >= 0);
  return used.length ? Math.max(...used) + 1 : 0;
}

export function readInventoryState(
  stores: InventoryStores,
  heroId = LOCAL_HERO_ID,
): InventoryState {
  const { inventory, stash } = stores;
  inventory.hydrate();
  stash.hydrate();
  const { state } = migrateLegacyInventory(
    heroId,
    { items: inventory.items, carryCapacityKg: inventory.carryCapacityKg },
    { chests: stash.chests, starterGiven: stash.starterGiven, cells: stash.cells },
  );
  state.idSeq = nextIdSeq(heroId, [...inventory.items, ...stash.cells]);
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

function shouldReroll(previous: InventoryItem | undefined, item: InventoryItem): boolean {
  if (!previous) return true;
  if (previous.amount !== item.amount) return true;
  return previous.slotKey !== item.slotKey && !item.slotKey.startsWith(STASH_PREFIX);
}

export function bagItemsOf(
  state: InventoryState,
  before: ReadonlyMap<string, InventoryItem>,
): InventoryItem[] {
  const items: InventoryItem[] = [];
  state.bag.forEach((cell, index) => {
    if (cell) items.push(toStoreItem(cell, BAG_SLOT_KEYS[index], before));
  });
  for (const slot of EQUIP_SLOTS) {
    const cell = state.equip[slot];
    if (cell) items.push(toStoreItem(cell, `eq:${slot}`, before));
  }
  return items;
}

export function writeInventoryState(stores: InventoryStores, state: InventoryState): void {
  const { inventory, stash } = stores;
  const before = new Map(
    [...inventory.items, ...stash.cells].flatMap((item) =>
      item ? [[item.id, item] as const] : [],
    ),
  );
  const items = bagItemsOf(state, before);
  const cells = state.stash.cells.map((cell, index) =>
    cell ? toStoreItem(cell, `${STASH_PREFIX}${index}`, before) : null,
  );
  const kept = new Set([...items, ...cells].flatMap((item) => (item ? [item.id] : [])));
  for (const id of Object.keys(inventory.rotationsById)) {
    if (!kept.has(id)) delete inventory.rotationsById[id];
  }
  inventory.items = items;
  inventory.carryCapacityKg = state.capacityKg;
  stash.cells = cells;
  stash.chests = state.stash.chests;
  for (const item of [...items, ...cells]) {
    if (!item) continue;
    if (shouldReroll(before.get(item.id), item)) inventory.rerollRotation(item.id);
    else inventory.ensureRotation(item.id);
  }
  if (inventory.selectedItemId && !kept.has(inventory.selectedItemId)) inventory.clearSelection();
  inventory.fillEmptySlotsWithHands();
  patchInventoryRecord({
    bag: {
      items: inventory.items,
      rotationsById: inventory.rotationsById,
      carryCapacityKg: inventory.carryCapacityKg,
    },
    stash: { chests: stash.chests, starterGiven: stash.starterGiven, cells: stash.cells },
  });
}

export interface DispatchOptions {
  commit?: boolean;
  context?: Partial<InventoryContext>;
  heroId?: string;
}

export interface DispatchResult {
  ok: boolean;
  events: DomainEvent[];
  before: InventoryState;
  after: InventoryState;
  reason?: string;
}

function run(state: InventoryState, command: HexEngineCommand, context: InventoryContext) {
  switch (command.type) {
    case 'GRANT_ITEM':
      return applyGrantItem(state, command);
    case 'CONSUME_ITEM':
      return applyConsumeItem(state, command);
    case 'MOVE_ITEM':
    case 'AUTO_PLACE_ITEM':
    case 'STORE_RESOURCES':
    case 'SORT_STASH':
    case 'UNLOCK_STASH_CHEST':
      return applyInventoryCommand(state, command, context);
    default:
      return null;
  }
}

const REJECTED = new Set([
  'ITEM_TRANSFER_REJECTED',
  'ITEM_GRANT_REJECTED',
  'ITEM_CONSUME_REJECTED',
]);

export function dispatchInventory(
  stores: InventoryStores,
  build: (base: { heroId: string; revision: number }) => HexEngineCommand,
  context: InventoryContext,
  options: DispatchOptions = {},
): DispatchResult {
  const heroId = options.heroId ?? LOCAL_HERO_ID;
  const before = readInventoryState(stores, heroId);
  const command = build({ heroId, revision: before.revision });
  const parsed = HEX_ENGINE_COMMAND_SCHEMAS[command.type].safeParse(command);
  if (!parsed.success) {
    return { ok: false, events: [], before, after: before, reason: 'INVALID_COMMAND' };
  }
  const result = run(before, parsed.data, { ...context, ...options.context });
  if (!result) return { ok: false, events: [], before, after: before, reason: 'UNSUPPORTED' };
  const rejected = result.events.find((event) => REJECTED.has(event.type));
  const after = result.inventory ?? before;
  if (options.commit !== false && !rejected && after !== before) writeInventoryState(stores, after);
  return {
    ok: !rejected,
    events: result.events,
    before,
    after,
    reason: (rejected?.payload as { reason?: string } | undefined)?.reason,
  };
}

export interface StockOutcome {
  ok: boolean;
  message?: string;
}

const NO_CONTEXT: InventoryContext = { stashOpen: false, battleOpen: false };

function grantMessage(reason: string | undefined, key: string, capacityKg: number): string {
  switch (reason) {
    case 'TOO_HEAVY':
      return `Too heavy! Carry limit: ${capacityKg} kg`;
    case 'BAG_FULL':
      return 'Inventory is full!';
    case 'NOT_STORABLE':
      return 'Hand cannot be added to inventory.';
    default:
      return `Unknown hexobject prototype: ${key}`;
  }
}

export function grantItem(
  stores: InventoryStores,
  key: string,
  amount: number,
  source: 'pickup' | 'loot' | 'starter' | 'dev',
): StockOutcome {
  const result = dispatchInventory(
    stores,
    ({ heroId, revision }) => ({
      type: 'GRANT_ITEM',
      payload: { heroId, revision, key, amount, source },
    }),
    NO_CONTEXT,
  );
  if (result.ok) return { ok: true };
  const reason = key === 'hand' ? 'NOT_STORABLE' : result.reason;
  return { ok: false, message: grantMessage(reason, key, stores.inventory.carryCapacityKg) };
}

export function consumeItem(stores: InventoryStores, key: string, amount: number): StockOutcome {
  const result = dispatchInventory(
    stores,
    ({ heroId, revision }) => ({
      type: 'CONSUME_ITEM',
      payload: { heroId, revision, key, amount },
    }),
    NO_CONTEXT,
  );
  return { ok: result.ok };
}
