import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TTraderDefinition } from './content-schema';

export const TRADERS = {
  ilva: {
    key: 'ilva',
    title: 'content.traders.ilva.title',
    line: 'content.traders.ilva.line',
    portraitPath: '/hex-assets/hex-constructs/camping/shop-hex.png',
    stallHexobjectKey: HEXOBJECT_KEYS.TRADER_STALL,
    sellRate: { num: 2, den: 5 },
    goodsSlots: 8,
    buybackSlots: 7,
    refresh: { baseWill: 20, factor: 2 },
    guaranteed: [{ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, min: 2, max: 5 }],
    pool: [
      { key: HEXOBJECT_KEYS.ENERGY_BOTTLE, weight: 4, min: 1, max: 4 },
      { key: HEXOBJECT_KEYS.MANA_BOTTLE, weight: 4, min: 1, max: 4 },
      { key: HEXOBJECT_KEYS.BONE_CHARM, weight: 2, min: 1, max: 1 },
      { key: HEXOBJECT_KEYS.AXE, weight: 2, min: 1, max: 1 },
      { key: HEXOBJECT_KEYS.PICKAXE, weight: 2, min: 1, max: 1 },
      { key: HEXOBJECT_KEYS.SWORD, weight: 1, min: 1, max: 1 },
      { key: HEXOBJECT_KEYS.SHIELD, weight: 1, min: 1, max: 1 },
      { key: HEXOBJECT_KEYS.RETURN_SCROLL, weight: 1, min: 1, max: 1 },
    ],
    rolls: 7,
    discounts: { chancePct: 30, percents: [10, 20, 25, 50], maxGoods: 3 },
  },
} as const satisfies Record<string, TTraderDefinition>;

export type TTraderKey = keyof typeof TRADERS;
export const TRADER_KEYS = Object.keys(TRADERS) as [TTraderKey, ...TTraderKey[]];
