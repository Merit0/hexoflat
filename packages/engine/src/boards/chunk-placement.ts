import type { SeededRandom } from '../utils/random-seeded';
import type { BoardChunk, BoardEdge } from '../content/boards/schemas';
import { parseBoardRows } from './board-rows';
import { edgeLocalCells } from './layout-zones';
import { DOOR_SYMBOL, ENTRY_SYMBOL } from './board-symbols';

export function countDoorsOnEdge(
  grid: string[][],
  width: number,
  height: number,
  edge: BoardEdge,
): number {
  return edgeLocalCells(width, height, edge).filter(
    ({ column, row }) => grid[row]?.[column] === DOOR_SYMBOL,
  ).length;
}

export function hasEntrySlot(grid: string[][]): boolean {
  return grid.some((row) => row.includes(ENTRY_SYMBOL));
}

export function flipGridVertically(grid: string[][]): string[][] {
  return [...grid].reverse();
}

export interface ChunkRequirement {
  biome: string;
  width: number;
  height: number;
  doorsNeededByEdge: Partial<Record<BoardEdge, number>>;
  needsEntrySlot: boolean;
}

export interface ChunkPlacementCandidate {
  chunk: BoardChunk;
  grid: string[][];
  flipped: boolean;
}

function candidateSatisfies(
  candidate: ChunkPlacementCandidate,
  requirement: ChunkRequirement,
): boolean {
  const { grid } = candidate;
  const { width, height } = requirement;

  for (const [edge, needed] of Object.entries(requirement.doorsNeededByEdge) as [
    BoardEdge,
    number,
  ][]) {
    if (countDoorsOnEdge(grid, width, height, edge) < needed) return false;
  }
  if (requirement.needsEntrySlot && !hasEntrySlot(grid)) return false;
  return true;
}

/** Builds every placement candidate (chunk, optionally vertically flipped for odd-height chunks) that matches biome/size, then filters to the ones with enough doors on each required edge and an entry slot if needed. */
export function findChunkCandidates(
  chunks: BoardChunk[],
  requirement: ChunkRequirement,
): ChunkPlacementCandidate[] {
  const candidates: ChunkPlacementCandidate[] = [];

  for (const chunk of chunks) {
    if (chunk.biome !== requirement.biome) continue;
    const grid = parseBoardRows(chunk.rows);
    if (grid.length !== requirement.height || grid[0]?.length !== requirement.width) continue;

    candidates.push({ chunk, grid, flipped: false });
    if (requirement.height % 2 === 1) {
      candidates.push({ chunk, grid: flipGridVertically(grid), flipped: true });
    }
  }

  return candidates.filter((candidate) => candidateSatisfies(candidate, requirement));
}

export function pickChunkForZone(
  chunks: BoardChunk[],
  requirement: ChunkRequirement,
  rng: SeededRandom,
): ChunkPlacementCandidate | undefined {
  const candidates = findChunkCandidates(chunks, requirement);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(rng() * candidates.length)];
}
