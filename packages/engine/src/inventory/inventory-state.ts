import { z } from 'zod';
import {
  EHexobjectGroup,
  EQUIP_SLOTS,
  type TEquipSlot,
} from '../abstraction/hexobject-abstraction';
import { getMeta, getPrototype } from '../content/content-accessors';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { BAG_CAPACITY, DEFAULT_CARRY_CAPACITY_KG } from './bag-layout';
import { STASH_CAPACITY, STASH_MAX_CHESTS } from './stash-constants';

const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

export const inventoryItemSchema = z.object({
  id: z.string().min(1),
  key: z.string().refine((key) => KNOWN_KEYS.has(key), 'unknown hexobject key'),
  type: z.nativeEnum(EHexobjectGroup),
  stackKey: z.string().optional(),
  amount: z.number().int().positive(),
});
export type InventoryStateItem = Omit<z.infer<typeof inventoryItemSchema>, 'key'> & {
  key: THexobjectKey;
};

const cellSchema = inventoryItemSchema.nullable();

function everyIdIsUnique(state: {
  bag: z.infer<typeof cellSchema>[];
  equip: Record<string, z.infer<typeof cellSchema>>;
  stash: { cells: z.infer<typeof cellSchema>[] };
}): boolean {
  const ids = [...state.bag, ...Object.values(state.equip), ...state.stash.cells]
    .filter((item) => item !== null)
    .map((item) => item.id);
  return new Set(ids).size === ids.length;
}

export const inventoryStateSchema = z
  .object({
    heroId: z.string().min(1),
    revision: z.number().int().nonnegative().default(0),
    capacityKg: z.number().positive().default(DEFAULT_CARRY_CAPACITY_KG),
    bag: z.array(cellSchema).length(BAG_CAPACITY),
    equip: z.object(
      Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, cellSchema])) as Record<
        TEquipSlot,
        typeof cellSchema
      >,
    ),
    stash: z.object({
      chests: z.number().int().min(0).max(STASH_MAX_CHESTS),
      cells: z.array(cellSchema).length(STASH_CAPACITY),
    }),
    idSeq: z.number().int().nonnegative().default(0),
  })
  .refine(everyIdIsUnique, 'an item id appears twice');

export type InventoryState = Omit<
  z.infer<typeof inventoryStateSchema>,
  'bag' | 'equip' | 'stash'
> & {
  bag: (InventoryStateItem | null)[];
  equip: Record<TEquipSlot, InventoryStateItem | null>;
  stash: { chests: number; cells: (InventoryStateItem | null)[] };
};

export function nextItemId(state: Pick<InventoryState, 'heroId' | 'idSeq'>): string {
  return `${state.heroId}:${state.idSeq}`;
}

export function mintItem(
  state: Pick<InventoryState, 'heroId' | 'idSeq'>,
  key: THexobjectKey,
  amount: number,
): InventoryStateItem {
  const stackable = !!getMeta(key)?.traits?.stackable;
  const item: InventoryStateItem = {
    id: nextItemId(state),
    key,
    type: getPrototype(key).groupType,
    ...(stackable ? { stackKey: getMeta(key)?.traits?.stackKey ?? key } : {}),
    amount,
  };
  state.idSeq += 1;
  return item;
}

export function emptyInventoryState(heroId: string): InventoryState {
  return {
    heroId,
    revision: 0,
    capacityKg: DEFAULT_CARRY_CAPACITY_KG,
    bag: Array.from({ length: BAG_CAPACITY }, () => null),
    equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])) as InventoryState['equip'],
    stash: {
      chests: 0,
      cells: Array.from({ length: STASH_CAPACITY }, () => null),
    },
    idSeq: 0,
  };
}
