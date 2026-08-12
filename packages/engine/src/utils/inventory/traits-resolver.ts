import { HEXOBJECT_KEYS, THexobjectKey } from '../../registry/hexobjects-registry';
import { getPrototype, getMeta } from '../../content';
import {
  EHexobjectGroup,
  THexobjectPrototype,
  type TEquipSlot,
} from '../../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../../abstraction/inventory-abstraction';
import { assertNever } from '../assert-never';

export type ResolvedInventoryView = {
  group: EHexobjectGroup;
  iconPath: string;

  title: string;
  description: string;

  stackable: boolean;
  stackKey?: string;
  defaultAmount: number;

  equipSlot?: TEquipSlot;
  weightKg: number;
};

function resolveProtoFields(proto: THexobjectPrototype) {
  const group = proto.groupType;
  const iconPath = proto.spritePath ?? '';
  const descriptionFallback = proto.description ?? '';

  let stackable = false;
  let defaultAmount = 1;
  let weightKg = 0;
  let equipSlot: TEquipSlot | undefined = undefined;
  const stackKey: string | undefined = undefined;

  switch (proto.groupType) {
    case EHexobjectGroup.LOOT: {
      stackable = !!proto.loot.traits?.stackable;
      defaultAmount = proto.loot.amount ?? 1;
      weightKg = proto.loot.traits?.weightKG ?? 0;
      break;
    }

    case EHexobjectGroup.RESOURCE: {
      defaultAmount = proto.resource.amount ?? 1;
      break;
    }

    case EHexobjectGroup.TOOL: {
      defaultAmount = 1;
      weightKg = proto.tool.traits?.weightKG ?? 0;
      break;
    }

    case EHexobjectGroup.EQUIPMENT: {
      defaultAmount = 1;
      equipSlot = getMeta(proto.hexobjectKey)?.equip?.slot;
      weightKg = proto.equipment.traits?.weightKG ?? 0;
      break;
    }

    case EHexobjectGroup.CREATURE: {
      defaultAmount = 1;
      break;
    }

    case EHexobjectGroup.CONSTRUCTION: {
      defaultAmount = 1;
      break;
    }

    default:
      assertNever(proto, 'Unhandled proto.groupType');
  }

  return {
    group,
    iconPath,
    descriptionFallback,
    stackable,
    stackKey,
    defaultAmount,
    equipSlot,
    weightKg,
  };
}

export function getItemUnitWeightKg(key: THexobjectKey): number {
  if (key === HEXOBJECT_KEYS.HAND) return 0;
  return getMeta(key)?.traits?.weightKG ?? 0;
}

export function calculateCarriedWeightKg(items: Pick<InventoryItem, 'key' | 'amount'>[]): number {
  return items.reduce((sum, item) => {
    if (item.key === HEXOBJECT_KEYS.HAND) return sum;
    return sum + getItemUnitWeightKg(item.key) * item.amount;
  }, 0);
}

export function canFitAdditionalWeight(
  carriedKg: number,
  capacityKg: number,
  incomingKg: number,
): boolean {
  return carriedKg + incomingKg <= capacityKg;
}

export function mergeItemStacks(target: InventoryItem, from: InventoryItem): boolean {
  if (!target.stackKey || !from.stackKey) return false;
  if (target.stackKey !== from.stackKey) return false;

  const maxStack = getMeta(from.key)?.traits?.maxStack ?? null;

  if (!maxStack) {
    target.amount += from.amount;
    return true;
  }

  const canAdd = Math.max(0, maxStack - target.amount);
  if (canAdd <= 0) return false;

  const add = Math.min(canAdd, from.amount);
  target.amount += add;
  from.amount -= add;

  return true;
}

export function resolveInventoryView(key: THexobjectKey): ResolvedInventoryView {
  const proto = getPrototype(key);
  const meta = getMeta(key);

  // proto is required by satisfies Record<THexobjectKey,...>
  // але якщо колись буде partial — зробимо страховку:
  if (!proto) {
    return {
      group: EHexobjectGroup.LOOT,
      iconPath: '',
      title: key,
      description: '',
      stackable: false,
      stackKey: undefined,
      defaultAmount: 1,
      equipSlot: undefined,
      weightKg: 0,
    };
  }

  const p = resolveProtoFields(proto);

  const title = meta?.title ?? key;
  const description = meta?.subtitle ?? meta?.title ?? p.descriptionFallback;

  const metaStackable = !!meta?.traits?.stackable;
  const stackable = meta?.traits ? metaStackable : p.stackable;
  const stackKey = meta?.traits?.stackKey ?? (stackable ? key : undefined);
  const equipSlot = meta?.equip?.slot ?? p.equipSlot;

  return {
    group: p.group,
    iconPath: p.iconPath,
    title,
    description,
    stackable,
    stackKey,
    defaultAmount: p.defaultAmount,
    equipSlot,
    weightKg: p.weightKg,
  };
}
