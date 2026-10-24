import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { SeededRandom } from '../../utils/random-seeded';
import { isWalkableFloor } from '../resolved-cell';
import type { BoardDraft } from './types';

export function intBetween(min: number, max: number, rng: SeededRandom): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffled<T>(items: readonly T[], rng: SeededRandom): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function inFrame(draft: BoardDraft, coord: IHexCoordinates): boolean {
  return (
    coord.columnIndex >= 0 &&
    coord.rowIndex >= 0 &&
    coord.columnIndex < draft.frame.columns &&
    coord.rowIndex < draft.frame.rows
  );
}

export function isFloor(draft: BoardDraft, coord: IHexCoordinates): boolean {
  return isWalkableFloor(draft.cellMap.get(coord));
}
