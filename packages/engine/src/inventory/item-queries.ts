import { getMeta, getPrototype, usePriceOf } from '../content';
import { DEFAULT_RARITY, rarityTone, type TRarityTone } from '../content/rarity-rules';
import { EHexobjectGroup, type TEquipSlot } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { calculateCarriedWeightKg } from '../utils/inventory/traits-resolver';
import { resolveEquipCompatibility } from '../utils/inventory/equip-compatibility';
import type { IInventoryAggregate, TItemCells } from './transfer-types';
import type { TItemLocation } from './item-location';

export type TItemCategory = 'gear' | 'tool' | 'consumable' | 'resource' | 'quest';

export const CATEGORY_ORDER: readonly TItemCategory[] = [
  'gear',
  'tool',
  'consumable',
  'resource',
  'quest',
];

/** Rarest first. Items without a rarity (coins, resources) come last. */
export const TONE_SORT_ORDER: readonly TRarityTone[] = [
  'god-executor',
  'spark-boss',
  'gloom-boss',
  'idol-boss',
  'spark',
  'gloom',
  'idol',
];

export function stackLimit(item: InventoryItem): number | null {
  const traits = getMeta(item.key)?.traits;
  if (!traits?.stackable || !item.stackKey) return null;
  return traits.maxStack ?? Number.POSITIVE_INFINITY;
}

export function canStackTogether(a: InventoryItem, b: InventoryItem): boolean {
  if (!a.stackKey || a.stackKey !== b.stackKey) return false;
  return stackLimit(a) !== null && stackLimit(b) !== null;
}

export function categoryOf(item: InventoryItem): TItemCategory {
  switch (item.type) {
    case EHexobjectGroup.EQUIPMENT:
      return 'gear';
    case EHexobjectGroup.TOOL:
      return 'tool';
    case EHexobjectGroup.LOOT:
      return usePriceOf(item.key) !== null ? 'consumable' : 'resource';
    default:
      return 'resource';
  }
}

export function rarityToneOf(item: InventoryItem): TRarityTone | null {
  const proto = getPrototype(item.key);
  if (proto.groupType === EHexobjectGroup.TOOL) {
    return rarityTone(proto.tool.rarity ?? DEFAULT_RARITY);
  }
  if (proto.groupType === EHexobjectGroup.EQUIPMENT) {
    return rarityTone(proto.equipment.rarity ?? DEFAULT_RARITY);
  }
  if (proto.groupType === EHexobjectGroup.LOOT && proto.loot.rarity) {
    return rarityTone(proto.loot.rarity);
  }
  return null;
}

export function carriedWeightKg(agg: IInventoryAggregate): number {
  const worn = Object.values(agg.equip).flatMap((item) => (item ? [item] : []));
  const packed = agg.bag.flatMap((item) => (item ? [item] : []));
  return calculateCarriedWeightKg([...packed, ...worn]);
}

export function fitsEquipSlot(item: InventoryItem, slot: TEquipSlot): boolean {
  return resolveEquipCompatibility(item, slot) === 'effect';
}

function cellsOf(agg: IInventoryAggregate, container: 'bag' | 'stash'): TItemCells {
  return container === 'bag' ? agg.bag : agg.stash;
}

/** `undefined` means the address does not exist; `null` means an empty cell. */
export function readAt(
  agg: IInventoryAggregate,
  at: TItemLocation,
): InventoryItem | null | undefined {
  if (at.container === 'equip') return agg.equip[at.slot];
  const cells = cellsOf(agg, at.container);
  if (!Number.isInteger(at.index) || at.index < 0 || at.index >= cells.length) return undefined;
  return cells[at.index];
}

export function writeAt(
  agg: IInventoryAggregate,
  at: TItemLocation,
  item: InventoryItem | null,
): IInventoryAggregate {
  if (at.container === 'equip') return { ...agg, equip: { ...agg.equip, [at.slot]: item } };
  const cells = cellsOf(agg, at.container).slice();
  cells[at.index] = item;
  return at.container === 'bag' ? { ...agg, bag: cells } : { ...agg, stash: cells };
}

export function isSameLocation(a: TItemLocation, b: TItemLocation): boolean {
  if (a.container !== b.container) return false;
  if (a.container === 'equip' && b.container === 'equip') return a.slot === b.slot;
  return a.container !== 'equip' && b.container !== 'equip' && a.index === b.index;
}

export function touchesStash(...places: TItemLocation[]): boolean {
  return places.some((place) => place.container === 'stash');
}

const WEIGHT_EPSILON = 1e-9;

/** Weight may drop at any time; it may only grow while it stays within the capacity. */
export function exceedsCapacity(
  before: IInventoryAggregate,
  after: IInventoryAggregate,
  capacityKg: number,
): boolean {
  const next = carriedWeightKg(after);
  return next > capacityKg + WEIGHT_EPSILON && next > carriedWeightKg(before) + WEIGHT_EPSILON;
}
