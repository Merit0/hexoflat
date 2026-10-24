import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { SeededRandom } from '../../../utils/random-seeded';
import { parseCoordinateKey } from '../../board-cell-map';
import { GROUND_CELL } from '../../resolved-cell';
import type { TerrainId } from '../../terrain';
import type { BoardDraft, Piece } from '../types';
import { hexDisc } from './blobs';

const EDGES = ['N', 'S', 'E', 'W'] as const;
type Edge = (typeof EDGES)[number];

const range = z.tuple([z.number().int().min(1), z.number().int().min(1)]);

const LakeParams = z.object({
  kind: z.literal('lake'),
  count: z.number().int().min(1).default(1),
  radius: z.union([z.number().int().min(1).max(2), range]).default([1, 2]),
  margin: z.number().int().min(1).default(2),
});

const RidgeParams = z.object({
  kind: z.literal('ridge'),
  edge: z.enum(EDGES).optional(),
  radius: z.number().int().min(1).max(2).default(1),
  inset: z.number().int().min(0).default(1),
  step: z.number().int().min(1).default(2),
});

const SeaParams = z.object({
  kind: z.literal('sea'),
  edges: z.array(z.enum(EDGES)).min(1).max(2).optional(),
  count: z.number().int().min(1).max(2).default(1),
  depth: range.default([2, 3]),
});

function intBetween(min: number, max: number, rng: SeededRandom): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(items: T[], rng: SeededRandom): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function inFrame(draft: BoardDraft, coord: IHexCoordinates): boolean {
  return (
    coord.columnIndex >= 0 &&
    coord.rowIndex >= 0 &&
    coord.columnIndex < draft.frame.columns &&
    coord.rowIndex < draft.frame.rows
  );
}

function isOpenGround(draft: BoardDraft, coord: IHexCoordinates): boolean {
  const cell = draft.cellMap.get(coord);
  return !!cell?.exists && !cell.hexobject && (cell.terrain ?? 'ground') === 'ground';
}

function paint(
  draft: BoardDraft,
  coord: IHexCoordinates,
  terrain: TerrainId,
  pieceId: string,
): boolean {
  if (!inFrame(draft, coord)) return false;
  const existing = draft.cellMap.get(coord);
  if (existing?.hexobject) return false;

  draft.cellMap.set(coord, { ...GROUND_CELL, terrain });
  draft.trace.record(coord, { stage: 'relief', pieceId, note: terrain });
  return true;
}

function pickEdges(wanted: Edge[] | undefined, count: number, rng: SeededRandom): Edge[] {
  return wanted ?? shuffled([...EDGES], rng).slice(0, count);
}

function edgeCoordinate(draft: BoardDraft, edge: Edge, along: number, inward: number) {
  const { columns, rows } = draft.frame;
  switch (edge) {
    case 'N':
      return { columnIndex: along, rowIndex: inward };
    case 'S':
      return { columnIndex: along, rowIndex: rows - 1 - inward };
    case 'W':
      return { columnIndex: inward, rowIndex: along };
    default:
      return { columnIndex: columns - 1 - inward, rowIndex: along };
  }
}

function edgeLength(draft: BoardDraft, edge: Edge): number {
  return edge === 'N' || edge === 'S' ? draft.frame.columns : draft.frame.rows;
}

export const reliefLake: Piece<z.infer<typeof LakeParams>> = {
  id: 'lake',
  schema: LakeParams,
  tableRule:
    'Put a small round pond on open ground, with at least two tiles of dry ground all around it so nobody is cut off from the shore.',
  run(draft, params, ctx) {
    const rng = ctx.rng;
    const candidates = shuffled(
      [...draft.cellMap.entries()].map(([key]) => parseCoordinateKey(key)),
      rng,
    );

    for (let lake = 0; lake < params.count; lake += 1) {
      const radius = Array.isArray(params.radius)
        ? intBetween(params.radius[0], params.radius[1], rng)
        : params.radius;
      const center = candidates.find((candidate) =>
        hexDisc(candidate, radius + params.margin).every((cell) => isOpenGround(draft, cell)),
      );
      if (!center) return;
      for (const cell of hexDisc(center, radius)) paint(draft, cell, 'water', 'lake');
    }
  },
};

export const reliefRidge: Piece<z.infer<typeof RidgeParams>> = {
  id: 'ridge',
  schema: RidgeParams,
  tableRule:
    'Line one edge of the board with overlapping round heaps of mountain, staggering them in and out so the ridge is not a straight bar.',
  run(draft, params, ctx) {
    const rng = ctx.rng;
    const edge = params.edge ?? pickEdges(undefined, 1, rng)[0];
    const length = edgeLength(draft, edge);

    let wobble = params.inset;
    for (let along = params.radius; along < length - params.radius; along += params.step) {
      wobble = Math.max(0, Math.min(params.inset + 1, wobble + intBetween(-1, 1, rng)));
      const center = edgeCoordinate(draft, edge, along, wobble);
      for (const cell of hexDisc(center, params.radius)) paint(draft, cell, 'mountain', 'ridge');
    }
  },
};

export const reliefSea: Piece<z.infer<typeof SeaParams>> = {
  id: 'sea',
  schema: SeaParams,
  tableRule:
    'Flood one or two edges of the board with water, a couple of tiles deep, letting the depth drift by one tile at a time so the shoreline wavers.',
  run(draft, params, ctx) {
    const rng = ctx.rng;
    const [minDepth, maxDepth] = params.depth;

    for (const edge of pickEdges(params.edges, params.count, rng)) {
      let depth = intBetween(minDepth, maxDepth, rng);
      for (let along = 0; along < edgeLength(draft, edge); along += 1) {
        depth = Math.max(minDepth, Math.min(maxDepth, depth + intBetween(-1, 1, rng)));
        for (let inward = 0; inward < depth; inward += 1) {
          paint(draft, edgeCoordinate(draft, edge, along, inward), 'water', 'sea');
        }
      }
    }
  },
};
