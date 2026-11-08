import { getMeta, getPrototype } from '../content';
import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type {
  IInventoryAggregate,
  ITransferOptions,
  TEquipment,
  TItemCells,
  TTransferResult,
} from './transfer-types';

let counter = 0;

export function item(key: THexobjectKey, amount = 1, id?: string): InventoryItem {
  const stackable = !!getMeta(key)?.traits?.stackable;
  counter += 1;
  return {
    id: id ?? `${key}-${counter}`,
    key,
    type: getPrototype(key).groupType,
    stackKey: stackable ? key : undefined,
    amount,
    slotKey: 'adapter-owned',
    isNew: false,
  };
}

export function cells(size: number, fill: Record<number, InventoryItem> = {}): TItemCells {
  return Array.from({ length: size }, (_, index) => fill[index] ?? null);
}

export function noEquipment(worn: Partial<Record<TEquipSlot, InventoryItem>> = {}): TEquipment {
  return {
    weapon: null,
    shield: null,
    armor: null,
    gloves: null,
    helm: null,
    boots: null,
    ring: null,
    amulet: null,
    ...worn,
  };
}

export function aggregate(parts: {
  bag?: Record<number, InventoryItem>;
  stash?: Record<number, InventoryItem>;
  worn?: Partial<Record<TEquipSlot, InventoryItem>>;
  bagSize?: number;
  stashSize?: number;
}): IInventoryAggregate {
  return {
    bag: cells(parts.bagSize ?? 6, parts.bag),
    stash: cells(parts.stashSize ?? 6, parts.stash),
    equip: noEquipment(parts.worn),
  };
}

export function options(over: Partial<ITransferOptions> = {}): ITransferOptions {
  let next = 0;
  return {
    split: false,
    capacityKg: 10,
    stashOpen: true,
    newId: () => `split-${(next += 1)}`,
    ...over,
  };
}

export const bag = (index: number) => ({ container: 'bag', index }) as const;
export const stash = (index: number) => ({ container: 'stash', index }) as const;
export const equip = (slot: TEquipSlot) => ({ container: 'equip', slot }) as const;

export function failure(result: TTransferResult): string {
  if (result.ok) throw new Error(`expected a refusal, got ${result.kind}`);
  return result.reason;
}

export function success(result: TTransferResult) {
  if (!result.ok) throw new Error(`expected success, got ${result.reason}`);
  return result;
}
