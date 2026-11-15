import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { deriveStream } from '../utils/random-seeded';
import { axialToOffset, coordinateKey, hexDistance, getHexNeighbors } from '../utils/hex-utils';
import type { SeekerBoard } from './quest-state';

export const FIELD_RADIUS = 6;
export const FIELD_CENTER = { q: 12, r: 12 };
const EDGE_GAP_CHANCE = 0.35;

export interface TreasureField extends SeekerBoard {
  start: IHexCoordinates;
}

export function createTreasureField(seed: string): TreasureField {
  const random = deriveStream(seed, 'quest:field');
  const center = axialToOffset(FIELD_CENTER);
  const all: IHexCoordinates[] = [];
  for (let dq = -FIELD_RADIUS; dq <= FIELD_RADIUS; dq += 1) {
    const from = Math.max(-FIELD_RADIUS, -dq - FIELD_RADIUS);
    const to = Math.min(FIELD_RADIUS, -dq + FIELD_RADIUS);
    for (let dr = from; dr <= to; dr += 1) {
      all.push(axialToOffset({ q: FIELD_CENTER.q + dq, r: FIELD_CENTER.r + dr }));
    }
  }
  const floor = all.filter(
    (hex) => hexDistance(center, hex) < FIELD_RADIUS || random() >= EDGE_GAP_CHANCE,
  );
  const edge = floor
    .filter((hex) => hexDistance(center, hex) === FIELD_RADIUS)
    .sort((a, b) => coordinateKey(a).localeCompare(coordinateKey(b)));
  const start = edge[Math.floor(random() * edge.length)];
  return { floor, start };
}

export function questExitHex(start: IHexCoordinates): IHexCoordinates {
  const center = axialToOffset(FIELD_CENTER);
  const neighbours = getHexNeighbors(start);
  return (
    neighbours.find((hex) => hexDistance(center, hex) > FIELD_RADIUS) ??
    neighbours[neighbours.length - 1]
  );
}
