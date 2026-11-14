import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { RandomNumberGenerator } from '../utils/random';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { floorKeys, type SeekerBoard } from './quest-state';

export interface Trail {
  trail: IHexCoordinates[];
  chestHex: IHexCoordinates;
}

const MIN_FREE_AROUND_TRAIL = 2;
const MIN_FREE_AROUND_CHEST = 3;
const MAX_ATTEMPTS = 400;

function shuffled<T>(items: readonly T[], random: RandomNumberGenerator): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function walk(
  board: Set<string>,
  start: IHexCoordinates,
  length: number,
  random: RandomNumberGenerator,
): IHexCoordinates[] | null {
  const startKey = coordinateKey(start);
  const startRing = new Set(getHexNeighbors(start).map(coordinateKey));
  const trail: IHexCoordinates[] = [];
  const used = new Set<string>();

  function touchesOnlyPrevious(candidate: IHexCoordinates): boolean {
    const key = coordinateKey(candidate);
    const last = trail.length - 1;
    for (const neighbor of getHexNeighbors(candidate)) {
      const neighborKey = coordinateKey(neighbor);
      if (!used.has(neighborKey)) continue;
      if (last < 0 || neighborKey !== coordinateKey(trail[last])) return false;
    }
    if (trail.length > 0 && startRing.has(key)) return false;
    return true;
  }

  function extend(): boolean {
    if (trail.length === length) return true;
    const from = trail.length === 0 ? start : trail[trail.length - 1];
    const options = shuffled(
      getHexNeighbors(from).filter((hex) => {
        const key = coordinateKey(hex);
        return board.has(key) && key !== startKey && !used.has(key) && touchesOnlyPrevious(hex);
      }),
      random,
    );
    for (const hex of options) {
      trail.push(hex);
      used.add(coordinateKey(hex));
      if (extend()) return true;
      used.delete(coordinateKey(hex));
      trail.pop();
    }
    return false;
  }

  return extend() ? trail : null;
}

function pickChestHex(
  board: Set<string>,
  trail: readonly IHexCoordinates[],
  start: IHexCoordinates,
  random: RandomNumberGenerator,
): IHexCoordinates | null {
  const trailKeys = new Set(trail.map(coordinateKey));
  const last = trail[trail.length - 1];
  const startKey = coordinateKey(start);
  const candidates = getHexNeighbors(last).filter((hex) => {
    const key = coordinateKey(hex);
    if (!board.has(key) || trailKeys.has(key) || key === startKey) return false;
    const neighbors = getHexNeighbors(hex);
    const touchesTrail = neighbors.filter((n) => trailKeys.has(coordinateKey(n)));
    if (touchesTrail.length !== 1) return false;
    const free = neighbors.filter(
      (n) => board.has(coordinateKey(n)) && coordinateKey(n) !== coordinateKey(last),
    );
    return free.length >= MIN_FREE_AROUND_CHEST;
  });
  return candidates.length === 0 ? null : shuffled(candidates, random)[0];
}

function hasRoomAroundTrail(
  board: Set<string>,
  trail: readonly IHexCoordinates[],
  chestHex: IHexCoordinates,
  start: IHexCoordinates,
): boolean {
  const excluded = new Set([
    ...trail.map(coordinateKey),
    coordinateKey(chestHex),
    coordinateKey(start),
  ]);
  return trail.every(
    (hex) =>
      getHexNeighbors(hex).filter(
        (n) => board.has(coordinateKey(n)) && !excluded.has(coordinateKey(n)),
      ).length >= MIN_FREE_AROUND_TRAIL,
  );
}

export function generateTrail(
  board: SeekerBoard,
  start: IHexCoordinates,
  length: number,
  random: RandomNumberGenerator,
): Trail | null {
  const floor = floorKeys(board);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const trail = walk(floor, start, length, random);
    if (!trail) continue;
    const chestHex = pickChestHex(floor, trail, start, random);
    if (chestHex && hasRoomAroundTrail(floor, trail, chestHex, start)) return { trail, chestHex };
  }
  return null;
}
