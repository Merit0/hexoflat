import type { ItemTypeDefinition } from '../token-content-schema';
import type { THeroStat } from './equipment-keys';

export type TypeBaseStats = Partial<Record<THeroStat, number>>;

export function typeBaseStats(type: Pick<ItemTypeDefinition, 'block' | 'base'>): TypeBaseStats {
  return {
    maxHearts: type.base?.hearts ?? 0,
    maxWill: type.base?.will ?? 0,
    blockSides: type.block?.sides ?? type.base?.blockSides ?? 0,
  };
}
