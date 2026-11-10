import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { TRADERS } from '../content/traders.content';
import type { TraderState } from './trade-state';
import type { ITraderRef } from './trade-types';

export const HERO = 'hero-1';
export const SEED = 'server-seed';
export const ILVA = TRADERS.ilva;
export const { COINS, HEALTH_BOTTLE, SWORD, SHIELD, AXE, MANA_BOTTLE } = HEXOBJECT_KEYS;

type TCell = [THexobjectKey, number];

export function inventoryWith(
  bag: Record<number, TCell>,
  equip: Partial<Record<TEquipSlot, TCell>> = {},
): InventoryState {
  const state = emptyInventoryState(HERO);
  for (const [index, [key, amount]] of Object.entries(bag)) {
    state.bag[Number(index)] = mintItem(state, key, amount);
  }
  for (const [slot, [key, amount]] of Object.entries(equip) as [TEquipSlot, TCell][]) {
    state.equip[slot] = mintItem(state, key, amount);
  }
  return state;
}

export function fullBag(key: THexobjectKey = SWORD): InventoryState {
  const state = emptyInventoryState(HERO);
  state.bag = state.bag.map(() => mintItem(state, key, 1));
  return state;
}

export function traderWith(
  goods: (TCell | null)[],
  buyback: ([THexobjectKey, number, number] | null)[] = [],
): ITraderRef {
  const state: TraderState = {
    serial: 0,
    trip: 0,
    paidRefreshes: 0,
    goods: Array.from({ length: ILVA.goodsSlots }, (_, index) => {
      const cell = goods[index];
      return cell ? { key: cell[0], amount: cell[1] } : null;
    }),
    buyback: Array.from({ length: ILVA.buybackSlots }, (_, index) => {
      const cell = buyback[index];
      return cell ? { key: cell[0], amount: cell[1], unitPrice: cell[2] } : null;
    }),
  };
  return { key: 'ilva', state };
}

export function bagAmount(state: InventoryState, key: THexobjectKey): number {
  return state.bag.reduce((sum, item) => (item?.key === key ? sum + item.amount : sum), 0);
}
