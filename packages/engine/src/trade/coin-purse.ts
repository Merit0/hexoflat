import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { mintItem, type InventoryState } from '../inventory/inventory-state';
import type { IInventoryAggregate } from '../inventory/transfer-types';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';

export interface IIdSequence {
  heroId: string;
  idSeq: number;
}

export function sequenceOf(inventory: Pick<InventoryState, 'heroId' | 'idSeq'>): IIdSequence {
  return { heroId: inventory.heroId, idSeq: inventory.idSeq };
}

export function freshPiece(seq: IIdSequence, key: THexobjectKey, amount: number): InventoryItem {
  return { ...mintItem(seq, key, amount), slotKey: '', isNew: false };
}

export function usedIdSeq(
  cells: readonly (InventoryItem | null)[],
  piece: InventoryItem,
  seq: IIdSequence,
  before: number,
): number {
  return cells.some((cell) => cell?.id === piece.id) ? seq.idSeq : before;
}

function bagCoinOrder(bag: readonly (InventoryItem | null)[]): number[] {
  return bag
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item?.key === HEXOBJECT_KEYS.COINS)
    .sort((a, b) => (a.item?.amount ?? 0) - (b.item?.amount ?? 0) || a.index - b.index)
    .map(({ index }) => index);
}

function takeFrom(item: InventoryItem | null, want: number): [InventoryItem | null, number] {
  if (!item || item.key !== HEXOBJECT_KEYS.COINS || want <= 0) return [item, 0];
  const taken = Math.min(item.amount, want);
  return [item.amount > taken ? { ...item, amount: item.amount - taken } : null, taken];
}

export function payCoins(agg: IInventoryAggregate, price: number): IInventoryAggregate | null {
  const bag = agg.bag.slice();
  const equip = { ...agg.equip };
  let left = price;
  for (const index of bagCoinOrder(bag)) {
    const [next, taken] = takeFrom(bag[index], left);
    bag[index] = next;
    left -= taken;
  }
  for (const slot of EQUIP_SLOTS) {
    const [next, taken] = takeFrom(equip[slot], left);
    equip[slot] = next;
    left -= taken;
  }
  return left > 0 ? null : { ...agg, bag, equip };
}
