import { z } from 'zod';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { axialToOffset, hexDistance, offsetToAxial } from '../../../utils/hex-utils';
import { hexLineAxial } from '../../../utils/hex-line';
import type { SeededRandom } from '../../../utils/random-seeded';
import { intOrRange, intRange } from '../piece-schemas';
import { GROUND_CELL } from '../../resolved-cell';
import type { BoardDraft, Piece } from '../types';
import { inFrame, intBetween, shuffled } from '../piece-utils';

const BlobsParams = z.object({
  kind: z.literal('blobs'),
  count: intOrRange(1),
  radius: z.number().int().min(1).max(4),
  link: z.enum(['chain', 'branch', 'loop']),
  neck: intRange(1, 2).default([1, 2]),
});
type BlobsParams = z.infer<typeof BlobsParams>;

const BLOB_ID_PREFIX = 'blob-';

interface Blob {
  id: string;
  center: IHexCoordinates;
}

interface Edge {
  a: number;
  b: number;
  line: IHexCoordinates[];
  length: number;
}

export function hexDisc(center: IHexCoordinates, radius: number): IHexCoordinates[] {
  const { q: cq, r: cr } = offsetToAxial(center);
  const cells: IHexCoordinates[] = [];
  for (let dq = -radius; dq <= radius; dq += 1) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr += 1) {
      cells.push(axialToOffset({ q: cq + dq, r: cr + dr }));
    }
  }
  return cells;
}

function fitsWithWallRing(draft: BoardDraft, center: IHexCoordinates, radius: number): boolean {
  return hexDisc(center, radius + 1).every((cell) => inFrame(draft, cell));
}

function placeBlobCenters(
  draft: BoardDraft,
  wanted: number,
  radius: number,
  rng: SeededRandom,
): Blob[] {
  const minSpacing = 2 * radius + 2;
  const candidates: IHexCoordinates[] = [];
  for (let rowIndex = radius + 1; rowIndex <= draft.frame.rows - radius - 2; rowIndex += 1) {
    for (
      let columnIndex = radius + 1;
      columnIndex <= draft.frame.columns - radius - 2;
      columnIndex += 1
    ) {
      const center = { columnIndex, rowIndex };
      if (fitsWithWallRing(draft, center, radius)) candidates.push(center);
    }
  }

  const blobs: Blob[] = [];
  for (const center of shuffled(candidates, rng)) {
    if (blobs.length === wanted) break;
    if (blobs.some((blob) => hexDistance(blob.center, center) < minSpacing)) continue;
    blobs.push({ id: `${BLOB_ID_PREFIX}${blobs.length}`, center });
  }
  return blobs;
}

function lineBetween(from: IHexCoordinates, to: IHexCoordinates): IHexCoordinates[] {
  return hexLineAxial(offsetToAxial(from), offsetToAxial(to)).map(axialToOffset);
}

function buildEdges(blobs: Blob[], radius: number): Edge[] {
  const edges: Edge[] = [];
  for (let a = 0; a < blobs.length; a += 1) {
    for (let b = a + 1; b < blobs.length; b += 1) {
      const line = lineBetween(blobs[a].center, blobs[b].center);
      const clear = blobs.every(
        (other, index) =>
          index === a ||
          index === b ||
          line.every((cell) => hexDistance(cell, other.center) > radius + 1),
      );
      if (clear) {
        edges.push({ a, b, line, length: hexDistance(blobs[a].center, blobs[b].center) });
      }
    }
  }
  return edges.sort((x, y) => x.length - y.length || x.a - y.a || x.b - y.b);
}

function touches(edge: Edge, node: number): boolean {
  return edge.a === node || edge.b === node;
}

function chooseEdges(
  edges: Edge[],
  blobCount: number,
  entry: number,
  mode: BlobsParams['link'],
): Edge[] {
  const connected = new Set<number>([entry]);
  const chosen: Edge[] = [];
  let tip = entry;

  while (connected.size < blobCount) {
    const candidates = edges.filter((edge) =>
      mode === 'chain'
        ? touches(edge, tip) && !(connected.has(edge.a) && connected.has(edge.b))
        : connected.has(edge.a) !== connected.has(edge.b),
    );
    const next = candidates[0];
    if (!next) break;
    chosen.push(next);
    tip = connected.has(next.a) ? next.b : next.a;
    connected.add(tip);
  }

  if (mode === 'loop') {
    const closing = edges.find((edge) => !chosen.includes(edge));
    if (closing) chosen.push(closing);
  }
  return chosen;
}

function graphDistances(blobCount: number, edges: Edge[], entry: number): number[] {
  const distance = Array.from({ length: blobCount }, () => Infinity);
  distance[entry] = 0;
  let frontier = [entry];
  while (frontier.length) {
    const next: number[] = [];
    for (const node of frontier) {
      for (const edge of edges) {
        if (!touches(edge, node)) continue;
        const other = edge.a === node ? edge.b : edge.a;
        if (distance[other] !== Infinity) continue;
        distance[other] = distance[node] + 1;
        next.push(other);
      }
    }
    frontier = next;
  }
  return distance;
}

function roleFor(distance: number, maxDistance: number): string {
  if (distance === 0) return 'entry';
  return distance === maxDistance ? 'deep' : 'room';
}

function carveNeck(
  draft: BoardDraft,
  edge: Edge,
  blobs: Blob[],
  radius: number,
  neck: BlobsParams['neck'],
  rng: SeededRandom,
): void {
  const width = intBetween(Math.min(...neck), Math.max(...neck), rng);
  const sideDirection = intBetween(0, 5, rng);
  const sideOffsets = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ][sideDirection];

  for (const cell of edge.line) {
    if (!draft.cellMap.has(cell)) draft.cellMap.set(cell, GROUND_CELL);
    draft.trace.record(cell, { stage: 'form', pieceId: 'blobs', note: 'neck' });
    if (width < 2) continue;

    const axial = offsetToAxial(cell);
    const side = axialToOffset({ q: axial.q + sideOffsets.q, r: axial.r + sideOffsets.r });
    const intrudes = blobs.some(
      (other, index) =>
        index !== edge.a && index !== edge.b && hexDistance(side, other.center) <= radius + 1,
    );
    if (inFrame(draft, side) && !intrudes && !draft.cellMap.has(side)) {
      draft.cellMap.set(side, GROUND_CELL);
    }
  }
}

export const formBlobs: Piece<BlobsParams> = {
  id: 'blobs',
  schema: BlobsParams,
  tableRule:
    'Lay down a few round rooms of the same size with a wall between them, then join them with narrow passages: in a line, as a tree, or as a tree plus one loop.',
  run(draft, params, ctx) {
    const { rng } = ctx;
    const wanted = Array.isArray(params.count)
      ? intBetween(params.count[0], params.count[1], rng)
      : params.count;
    const blobs = placeBlobCenters(draft, wanted, params.radius, rng);
    if (blobs.length === 0) return;

    const entry = intBetween(0, blobs.length - 1, rng);
    const edges = chooseEdges(buildEdges(blobs, params.radius), blobs.length, entry, params.link);
    const distances = graphDistances(blobs.length, edges, entry);
    const reachable = distances.filter((distance) => distance !== Infinity);
    const maxDistance = Math.max(...reachable);

    blobs.forEach((blob, index) => {
      const cells = hexDisc(blob.center, params.radius);
      for (const cell of cells) {
        draft.cellMap.set(cell, { ...GROUND_CELL, regionId: blob.id });
        draft.trace.record(cell, { stage: 'form', pieceId: 'blobs', note: blob.id });
      }
      draft.regions.push({
        id: blob.id,
        role: roleFor(distances[index], maxDistance),
        cells,
      });
    });

    for (const edge of edges) {
      carveNeck(draft, edge, blobs, params.radius, params.neck, rng);
      draft.links.push({ from: blobs[edge.a].id, to: blobs[edge.b].id });
    }
  },
};
