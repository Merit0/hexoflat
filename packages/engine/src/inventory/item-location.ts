import type { TEquipSlot } from '../abstraction/hexobject-abstraction';

export type TItemContainer = 'bag' | 'stash' | 'equip';

export type TItemLocation =
  | { container: 'bag'; index: number }
  | { container: 'stash'; index: number }
  | { container: 'equip'; slot: TEquipSlot };
