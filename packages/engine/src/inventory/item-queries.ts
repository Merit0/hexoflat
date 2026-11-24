import { itemDimensionOf } from './item-dimension';
import { getMeta, getPrototype, usePriceOf } from '../content';
import {
  DEFAULT_ITEM_TOKEN_TYPE,
  LIGHT_NAMES_BY_SORT_RANK,
  lightNameOf,
  itemTokenTypeOf,
  type TLightName,
} from '../content/token-type-rules';
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

export const TONE_SORT_ORDER: readonly TLightName[] = LIGHT_NAMES_BY_SORT_RANK;

export function stackLimit(item: InventoryItem): number | null {
  const traits = getMeta(item.key)?.traits;
  if (!traits?.stackable || !item.stackKey) return null;
  return traits.maxStack ?? Number.POSITIVE_INFINITY;
}

export function canStackTogether(a: InventoryItem, b: InventoryItem): boolean {
  if (a.token || b.token) return false;
  if (!a.stackKey || a.stackKey !== b.stackKey) return false;
  if (itemDimensionOf(a) !== itemDimensionOf(b)) return false;
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

export function inventoryLightNameOf(item: InventoryItem): TLightName | null {
  if (item.token) return lightNameOf(itemTokenTypeOf(item.token));
  const proto = getPrototype(item.key);
  if (proto.groupType === EHexobjectGroup.TOOL) {
    return lightNameOf(proto.tool.tokenType ?? DEFAULT_ITEM_TOKEN_TYPE);
  }
  if (proto.groupType === EHexobjectGroup.EQUIPMENT) {
    return lightNameOf(proto.equipment.tokenType ?? DEFAULT_ITEM_TOKEN_TYPE);
  }
  if (proto.groupType === EHexobjectGroup.LOOT && proto.loot.tokenType) {
    return lightNameOf(proto.loot.tokenType);
  }
  return null;
}

function toneRank(item: InventoryItem): number {
  const tone = inventoryLightNameOf(item);
  return tone ? TONE_SORT_ORDER.indexOf(tone) : TONE_SORT_ORDER.length;
}

export function compareItemsForSort(a: InventoryItem, b: InventoryItem): number {
  return (
    CATEGORY_ORDER.indexOf(categoryOf(a)) - CATEGORY_ORDER.indexOf(categoryOf(b)) ||
    toneRank(a) - toneRank(b) ||
    a.key.localeCompare(b.key)
  );
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

export function exceedsCapacity(
  before: IInventoryAggregate,
  after: IInventoryAggregate,
  capacityKg: number,
): boolean {
  const next = carriedWeightKg(after);
  return next > capacityKg + WEIGHT_EPSILON && next > carriedWeightKg(before) + WEIGHT_EPSILON;
}
