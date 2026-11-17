import { AXIAL_DIRS, type Axial } from '../utils/hex-utils';
import type { LootNeighbour } from './place-loot';

export function lootNeighbours(
  target: Axial,
  isFree: (hex: Axial) => boolean | null,
): LootNeighbour[] {
  return AXIAL_DIRS.flatMap((dir) => {
    const hex = { q: target.q + dir.q, r: target.r + dir.r };
    const free = isFree(hex);
    return free === null ? [] : [{ hex, free }];
  });
}
