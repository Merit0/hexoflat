import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { axialToOffset, type Axial } from '../utils/hex-utils';
import type { LootDrop } from './loot-table';

export type OffsetPlacement<K extends string> = Record<K, IHexCoordinates> & {
  itemKey: LootDrop['itemKey'];
  amount: number;
};

export function offsetPlacement<K extends string>(
  placement: { hex: Axial; itemKey: LootDrop['itemKey']; amount: number },
  key: K,
): OffsetPlacement<K> {
  return {
    [key]: axialToOffset(placement.hex),
    itemKey: placement.itemKey,
    amount: placement.amount,
  } as OffsetPlacement<K>;
}
