import { ITEM_TYPES } from '../content/item-types.content';
import type { EHexActionType } from '../enums/hex-action-type';
import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import type { ItemTypeDefinition, TItemSlot } from './token-content-schema';

const TYPE_BY_KEY: ReadonlyMap<string, ItemTypeDefinition> = new Map(
  ITEM_TYPES.map((type) => [type.key, type] as const),
);

export function itemTypeOf(key: string | null | undefined): ItemTypeDefinition | null {
  return key ? (TYPE_BY_KEY.get(key) ?? null) : null;
}

export function toolActionOf(type: string | null | undefined): EHexActionType | null {
  return itemTypeOf(type)?.tool?.action ?? null;
}

export function toolWearOf(type: string | null | undefined): number | null {
  return itemTypeOf(type)?.tool?.durabilityCostPct ?? null;
}

export function itemSlotOf(type: string | null | undefined): TItemSlot | null {
  return itemTypeOf(type)?.slot ?? null;
}

export function fixedHandSlotOf(type: string | null | undefined): TEquipSlot | undefined {
  const slot = itemSlotOf(type);
  return slot === 'weapon' || slot === 'shield' ? slot : undefined;
}

export function strikeHeartsOf(type: string | null | undefined): number | null {
  const strike = itemTypeOf(type)?.strike;
  return strike === undefined ? null : strike / 2;
}
