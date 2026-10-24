import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { CONTENT } from '../content';
import { getMeta } from '../content/content-accessors';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

export interface BoardMeasurements {
  totalTiles: number;
  passableTiles: number;
  meanPassableNeighbours: number;
  shareLowDegree: number;
  stepsToObject: Record<string, number | null>;
  farthestPassableSteps: number;
  willCostTotal: number;
}

const LOW_DEGREE_MAX_NEIGHBOURS = 2;

function objectWillCost(key: THexobjectKey): number {
  const actions = getMeta(key).actions ?? {};
  return Object.values(actions).reduce((sum, action) => sum + (action?.willCost ?? 0), 0);
}

function bfsSteps(passable: Set<string>, starts: IHexCoordinates[]): Map<string, number> {
  const steps = new Map<string, number>();
  let frontier = starts.filter((start) => passable.has(coordinateKey(start)));
  frontier.forEach((start) => steps.set(coordinateKey(start), 0));

  while (frontier.length) {
    const next: IHexCoordinates[] = [];
    for (const current of frontier) {
      const distance = steps.get(coordinateKey(current)) as number;
      for (const neighbor of getHexNeighbors(current)) {
        const key = coordinateKey(neighbor);
        if (!passable.has(key) || steps.has(key)) continue;
        steps.set(key, distance + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return steps;
}

export function measureBoard(
  map: HexMapModel,
  entryHexobjectKey: THexobjectKey,
): BoardMeasurements {
  const tiles = map.tiles;
  const passable = new Set<string>();
  for (const tile of tiles) {
    const key = tile.hexobject?.hexobjectKey;
    if (!key || CONTENT[key]?.collision !== EHexCollision.SOLID) {
      passable.add(coordinateKey(tile.coordinates));
    }
  }

  let neighbourSum = 0;
  let lowDegree = 0;
  for (const tile of tiles) {
    if (!passable.has(coordinateKey(tile.coordinates))) continue;
    const degree = getHexNeighbors(tile.coordinates).filter((n) =>
      passable.has(coordinateKey(n)),
    ).length;
    neighbourSum += degree;
    if (degree <= LOW_DEGREE_MAX_NEIGHBOURS) lowDegree += 1;
  }

  const entryTile = tiles.find((tile) => tile.hexobject?.hexobjectKey === entryHexobjectKey);
  const steps = entryTile
    ? bfsSteps(passable, getHexNeighbors(entryTile.coordinates))
    : new Map<string, number>();

  const stepsToObject: Record<string, number | null> = {};
  let willCostTotal = 0;
  for (const tile of tiles) {
    const key = tile.hexobject?.hexobjectKey;
    if (!key) continue;
    willCostTotal += objectWillCost(key);
    if (key === HEXOBJECT_KEYS.STONE_WALL) continue;
    const reached = getHexNeighbors(tile.coordinates)
      .map((n) => steps.get(coordinateKey(n)))
      .filter((value): value is number => value !== undefined);
    const best = reached.length ? Math.min(...reached) : null;
    const known = stepsToObject[key];
    if (known === undefined || (best !== null && (known === null || best < known))) {
      stepsToObject[key] = best;
    }
  }

  return {
    totalTiles: tiles.length,
    passableTiles: passable.size,
    meanPassableNeighbours: passable.size ? neighbourSum / passable.size : 0,
    shareLowDegree: passable.size ? lowDegree / passable.size : 0,
    stepsToObject,
    farthestPassableSteps: Math.max(0, ...steps.values()),
    willCostTotal,
  };
}
