import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';

const BOTTLE = 'M10 3 H14 M10.5 3 V8 L6 15 A5.5 5.5 0 0 0 18 15 L13.5 8 V3';

export const ICON_PATHS = {
  sword: 'M20 4 L20 9 L9.5 19.5 L4.5 14.5 L15 4 Z M7.5 12 L12 16.5 M3 21 L6 18',
  shield: 'M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z M12 7 V17',
  axe: 'M15 3 L7 21 M12.5 8.5 C15 5 19 5 21 6.5 C20 10.5 16.5 12.5 13.5 11.5',
  pickaxe: 'M4 7.5 C8 3 16 3 20 7.5 C16 5.8 8 5.8 4 7.5 Z M12 5.5 V21',
  hand: 'M8 14 V6 A1.5 1.5 0 0 1 11 6 V11 M11 10 V4.5 A1.5 1.5 0 0 1 14 4.5 V11 M14 10.5 V6 A1.5 1.5 0 0 1 17 6 V14 C17 18.5 14.5 21 11.5 21 C8.5 21 7 19.5 5.5 16.5 L4.3 14 A1.4 1.4 0 0 1 6.7 12.7 L8 15',
  coins:
    'M5 7 A7 2.5 0 1 0 19 7 A7 2.5 0 1 0 5 7 Z M5 7 V11 A7 2.5 0 0 0 19 11 V7 M5 11 V15 A7 2.5 0 0 0 19 15 V11 M5 15 V18 A7 2.5 0 0 0 19 18 V15',
  book: 'M4 5 C7 4 10 4.5 12 6 C14 4.5 17 4 20 5 V19 C17 18 14 18.5 12 20 C10 18.5 7 18 4 19 Z M12 6 V20',
  healthBottle: `${BOTTLE} M12 18.5 C10 17 9 15.8 9.6 14.8 C10.2 13.8 11.4 14 12 15 C12.6 14 13.8 13.8 14.4 14.8 C15 15.8 14 17 12 18.5 Z`,
  energyBottle: `${BOTTLE} M12.8 12.5 L10.8 15.8 H13.2 L11.2 19`,
  manaBottle: `${BOTTLE} M12 13 L14.6 14.5 V17.5 L12 19 L9.4 17.5 V14.5 Z`,
  wood: 'M4 15 L16.5 6 A2.5 2.5 0 0 1 20 10 L7.5 19 A2.5 2.5 0 0 1 4 15 Z M16.5 6 A2.5 2.5 0 0 0 20 10 M9 8.5 C9 5.5 11 3.5 14 3.5 C14 6.5 12 8.5 9 8.5 Z M9 8.5 L12 5.5',
  rock: 'M4 16 L8 7 L15 5 L20 12 L16 19 L8 20 Z M8 7 L11 13 L20 12 M11 13 L8 20',
  helm: 'M5 15 V11 A7 7 0 0 1 19 11 V15 Z M12 4 V15 M9 18.5 H15',
  armor: 'M8 4 L5 6 L3 11 L6 12 V20 H18 V12 L21 11 L19 6 L16 4 C15 6.5 9 6.5 8 4 Z M12 9 V20',
  gloves:
    'M8 21 V14 L5.8 10.2 A1.3 1.3 0 0 1 8.1 9 L9 10.5 V5 A1.3 1.3 0 0 1 11.6 5 V10 M11.6 9.5 V4 A1.3 1.3 0 0 1 14.2 4 V10 M14.2 9.5 V5.5 A1.3 1.3 0 0 1 16.8 5.5 V15 C16.8 17.5 16 19 16 21 Z',
  boots: 'M8 3 H13 V13 L19 15.5 V20 H6 V13 Z M6 17 H19',
  ring: 'M6 15 A6 6 0 1 0 18 15 A6 6 0 1 0 6 15 Z M9 6 L12 3 L15 6 L12 9 Z',
  amulet: 'M6 3 L12 11 L18 3 M12 11 L16 15.5 L12 21 L8 15.5 Z',
  weight: 'M7 9 H17 L19 20 H5 Z M9 9 A3 3 0 1 1 15 9',
  durability: 'M3 7 H16 C16 9 18 10 21 10 V11 H15.5 L14.5 14 H17.5 V18 H6.5 V14 H9.5 L8.5 11 H3 Z',
  stack: 'M12 3 L21 8 L12 13 L3 8 Z M3 12 L12 17 L21 12 M3 16 L12 21 L21 16',
  chest: 'M4 11 V20 H20 V11 M4 11 C4 6 6 4 12 4 C18 4 20 6 20 11 Z M10 11 V14 H14 V11',
  better: 'M6 15 L12 9 L18 15',
  worse: 'M6 9 L12 15 L18 9',
} as const;

export type TIconName = keyof typeof ICON_PATHS;

export const ITEM_ICON_BY_KEY: Partial<Record<THexobjectKey, TIconName>> = {
  sword: 'sword',
  shield: 'shield',
  axe: 'axe',
  pickaxe: 'pickaxe',
  hand: 'hand',
  coins: 'coins',
  'knowledge-book': 'book',
  'health-bottle': 'healthBottle',
  'energy-bottle': 'energyBottle',
  'mana-bottle': 'manaBottle',
  'wood-and-leaves': 'wood',
  rock: 'rock',
};

export const EQUIP_SLOT_ICON: Record<TEquipSlot, TIconName> = {
  weapon: 'sword',
  shield: 'shield',
  armor: 'armor',
  gloves: 'gloves',
  helm: 'helm',
  boots: 'boots',
  ring: 'ring',
  amulet: 'amulet',
};
