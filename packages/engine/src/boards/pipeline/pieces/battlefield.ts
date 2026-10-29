import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  offsetToAxial,
} from '../../../utils/hex-utils';
import type { SeededRandom } from '../../../utils/random-seeded';
import { parseCoordinateKey } from '../../board-cell-map';
import type { TerrainId } from '../../terrain';
import { intRange } from '../piece-schemas';
import { intBetween, shuffled } from '../piece-utils';
import type { BoardDraft, CheckResult, Piece } from '../types';

const BLOCKING_OBJECTS: ReadonlySet<string> = new Set([
  HEXOBJECT_KEYS.STONE_WALL,
  HEXOBJECT_KEYS.ROCK,
]);

export function battlefieldCenter(draft: Pick<BoardDraft, 'frame'>): IHexCoordinates {
  return {
    columnIndex: Math.floor(draft.frame.columns / 2),
    rowIndex: Math.floor(draft.frame.rows / 2),
  };
}

export function ringOf(draft: Pick<BoardDraft, 'frame'>, coord: IHexCoordinates): number {
  const a = offsetToAxial(coord);
  const c = offsetToAxial(battlefieldCenter(draft));
  return (Math.abs(a.q - c.q) + Math.abs(a.r - c.r) + Math.abs(a.q + a.r - c.q - c.r)) / 2;
}

function fieldCells(draft: BoardDraft): IHexCoordinates[] {
  return [...draft.cellMap.entries()]
    .filter(([, c]) => c.exists && c.regionId === 'field')
    .map(([k]) => parseCoordinateKey(k));
}

function isOpenGround(draft: BoardDraft, coord: IHexCoordinates): boolean {
  const cell = draft.cellMap.get(coord);
  return !!cell?.exists && !cell.hexobject && (cell.terrain ?? 'ground') === 'ground';
}

function terrainAtCell(draft: BoardDraft, coord: IHexCoordinates): TerrainId | null {
  const cell = draft.cellMap.get(coord);
  return cell?.exists ? (cell.terrain ?? 'ground') : null;
}

function innerOpen(draft: BoardDraft, maxRing: number): IHexCoordinates[] {
  return fieldCells(draft).filter((c) => ringOf(draft, c) <= maxRing && isOpenGround(draft, c));
}

const HexagonParams = z.object({
  kind: z.literal('hexagon'),
  radius: z.number().int().min(2).max(5),
  edgeNoise: intRange(0, 12).default([0, 0]),
});

export const formHexagon: Piece<z.infer<typeof HexagonParams>> = {
  id: 'hexagon',
  schema: HexagonParams,
  tableRule:
    'Lay a hexagon of tiles around the middle of the table, then take a few tiles off its outer edge so the field looks natural.',
  run(draft, params, ctx) {
    const center = offsetToAxial(battlefieldCenter(draft));
    const cells: IHexCoordinates[] = [];
    for (let dq = -params.radius; dq <= params.radius; dq++) {
      for (let dr = -params.radius; dr <= params.radius; dr++) {
        if (Math.abs(dq + dr) > params.radius) continue;
        cells.push(axialToOffset({ q: center.q + dq, r: center.r + dr }));
      }
    }
    const edge = cells.filter((c) => ringOf(draft, c) === params.radius);
    const removed = new Set(
      shuffled(edge, ctx.rng)
        .slice(0, intBetween(params.edgeNoise[0], params.edgeNoise[1], ctx.rng))
        .map(coordinateKey),
    );
    const kept = cells.filter((c) => !removed.has(coordinateKey(c)));
    for (const coord of kept) draft.cellMap.set(coord, { exists: true, regionId: 'field' });
    draft.regions.push({ id: 'field', role: 'field', cells: kept });
  },
};

function setTerrain(
  draft: BoardDraft,
  coord: IHexCoordinates,
  terrain: TerrainId,
  pieceId: string,
) {
  draft.cellMap.set(coord, { ...draft.cellMap.get(coord)!, terrain });
  draft.trace.record(coord, { stage: 'relief', pieceId, note: terrain });
}

function growCluster(
  draft: BoardDraft,
  size: number,
  rng: SeededRandom,
  maxRing: number,
): IHexCoordinates[] {
  const start = shuffled(innerOpen(draft, maxRing), rng)[0];
  if (!start) return [];
  const cluster = [start];
  while (cluster.length < size) {
    const options = cluster
      .flatMap(getHexNeighbors)
      .filter((c) => ringOf(draft, c) <= maxRing && isOpenGround(draft, c))
      .filter((c) => !cluster.some((k) => coordinateKey(k) === coordinateKey(c)));
    const next = shuffled(options, rng)[0];
    if (!next) break;
    cluster.push(next);
  }
  return cluster;
}

const FeaturesParams = z.object({
  kind: z.literal('battle-features'),
  hazards: intRange(0, 4),
  ledges: intRange(0, 6),
  rubble: intRange(0, 8),
  oil: intRange(0, 3),
  innerRing: z.number().int().min(1).default(3),
});

export const reliefBattleFeatures: Piece<z.infer<typeof FeaturesParams>> = {
  id: 'battle-features',
  schema: FeaturesParams,
  tableRule:
    'Inside the outer ring: place the saws, a run of ledge tiles side by side, scattered rubble, and oil right next to a saw.',
  run(draft, params, ctx) {
    const { rng } = ctx;
    const pick = (n: number) => shuffled(innerOpen(draft, params.innerRing), rng).slice(0, n);
    const saws = pick(intBetween(...params.hazards, rng));
    for (const c of saws) setTerrain(draft, c, 'saw', 'battle-features');
    for (const c of growCluster(draft, intBetween(...params.ledges, rng), rng, params.innerRing)) {
      setTerrain(draft, c, 'ledge', 'battle-features');
    }
    const oilSpots = shuffled(
      saws.flatMap(getHexNeighbors).filter((c) => isOpenGround(draft, c)),
      rng,
    );
    for (const c of oilSpots.slice(0, intBetween(...params.oil, rng)))
      setTerrain(draft, c, 'oil', 'battle-features');
    for (const c of pick(intBetween(...params.rubble, rng)))
      setTerrain(draft, c, 'rubble', 'battle-features');
  },
};

const CoverParams = z.object({
  kind: z.literal('battle-cover'),
  cover: intRange(0, 8),
  innerRing: z.number().int().min(1).default(3),
});

export const objectsBattleCover: Piece<z.infer<typeof CoverParams>> = {
  id: 'battle-cover',
  schema: CoverParams,
  tableRule:
    'Stand stone pillars and boulders on plain floor inside the outer ring, never two side by side; flip a coin for each: heads pillar, tails boulder.',
  run(draft, params, ctx) {
    const { rng } = ctx;
    const count = intBetween(...params.cover, rng);
    const placed: IHexCoordinates[] = [];
    for (const coord of shuffled(innerOpen(draft, params.innerRing), rng)) {
      if (placed.length >= count) break;
      const touching = getHexNeighbors(coord).some((n) =>
        placed.some((p) => coordinateKey(p) === coordinateKey(n)),
      );
      if (touching) continue;
      const hexobjectKey = rng() < 0.5 ? HEXOBJECT_KEYS.STONE_WALL : HEXOBJECT_KEYS.ROCK;
      draft.cellMap.set(coord, { ...draft.cellMap.get(coord)!, hexobject: { hexobjectKey } });
      draft.trace.record(coord, { stage: 'objects', pieceId: 'battle-cover', note: hexobjectKey });
      placed.push(coord);
    }
  },
};

export interface TacticalCounts {
  hazards: number;
  ledges: number;
  cover: number;
  combos: number;
  connected: boolean;
}

function isWalkable(draft: BoardDraft, coord: IHexCoordinates): boolean {
  const cell = draft.cellMap.get(coord);
  if (!cell?.exists || cell.terrain === 'saw') return false;
  return !cell.hexobject || !BLOCKING_OBJECTS.has(cell.hexobject.hexobjectKey);
}

function walkableConnected(draft: BoardDraft): boolean {
  const walkable = fieldCells(draft).filter((c) => isWalkable(draft, c));
  if (!walkable.length) return false;
  const seen = new Set<string>([coordinateKey(walkable[0])]);
  const stack = [walkable[0]];
  while (stack.length) {
    for (const next of getHexNeighbors(stack.pop()!)) {
      if (seen.has(coordinateKey(next)) || !isWalkable(draft, next)) continue;
      seen.add(coordinateKey(next));
      stack.push(next);
    }
  }
  return seen.size === walkable.length;
}

export function tacticalCounts(draft: BoardDraft): TacticalCounts {
  const cells = fieldCells(draft);
  const of = (t: TerrainId) => cells.filter((c) => terrainAtCell(draft, c) === t);
  const saws = of('saw');
  const comboNear = (c: IHexCoordinates) =>
    getHexNeighbors(c).some((n) => ['oil', 'ledge'].includes(terrainAtCell(draft, n) ?? ''));
  return {
    hazards: saws.length,
    ledges: of('ledge').length,
    cover: cells.filter((c) => {
      const key = draft.cellMap.get(c)?.hexobject?.hexobjectKey;
      return !!key && BLOCKING_OBJECTS.has(key);
    }).length,
    combos: saws.filter(comboNear).length,
    connected: walkableConnected(draft),
  };
}

const BudgetParams = z.object({
  kind: z.literal('tactical-budget'),
  hazards: intRange(0, 4),
  minLedges: z.number().int().min(0),
  cover: intRange(0, 8),
  minCombos: z.number().int().min(0).default(1),
});

export const checkTacticalBudget: Piece<z.infer<typeof BudgetParams>, CheckResult> = {
  id: 'tactical-budget',
  schema: BudgetParams,
  tableRule:
    'Before play, count: one or two saws, at least one ledge, two to four pillars or boulders, a saw with oil or a ledge beside it, and a free path between any two open tiles. If not, deal the field again.',
  run(draft, params) {
    const counts = tacticalCounts(draft);
    const within = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
    if (!within(counts.hazards, params.hazards))
      return { ok: false, reason: `hazards ${counts.hazards}` };
    if (counts.ledges < params.minLedges) return { ok: false, reason: `ledges ${counts.ledges}` };
    if (!within(counts.cover, params.cover)) return { ok: false, reason: `cover ${counts.cover}` };
    if (counts.combos < params.minCombos) return { ok: false, reason: 'no push combo' };
    if (!counts.connected) return { ok: false, reason: 'field is split' };
    return { ok: true };
  },
};
