import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { deriveStream, type SeededRandom } from '../utils/random-seeded';
import type { BoardLayout, GeneratedBoardPreset } from '../content/boards/schemas';
import { BOARD_CHUNKS } from '../content/boards/chunks';
import { BOARD_LAYOUTS } from '../content/boards/layouts';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { attemptSeed } from './board-seed';
import { parseBoardRows } from './board-rows';
import { pickChunkForZone, type ChunkPlacementCandidate } from './chunk-placement';
import { computeZoneRequirement, materializeZoneChunk, type ZonePlacement } from './zone-placement';
import { carveAllLinks } from './door-carving';
import { placeEntryObject, fillSlots } from './board-content-filling';
import { resolveDeepWallsToVoid } from './wall-void-resolution';
import { checkGeneratedBoardReachable } from './board-reachability';
import { BoardCellMap, parseCoordinateKey } from './board-cell-map';
import { VOID_CELL } from './resolved-cell';
import { assembleHexMapModel } from './hex-map-assembly';
import type { DungeonBoardDescriptor } from './board-descriptors';

const MAX_ATTEMPTS = 12;

export interface BuiltDungeonBoard {
  map: HexMapModel;
  descriptor: DungeonBoardDescriptor;
}

function pickLayout(preset: GeneratedBoardPreset, rng: SeededRandom): BoardLayout {
  const candidates = BOARD_LAYOUTS.filter((layout) => preset.layouts.includes(layout.id));
  if (candidates.length === 0) {
    throw new Error(`preset "${preset.id}" references no known layout`);
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

function resolveForcedCandidate(chunkId: string): ChunkPlacementCandidate {
  const chunk = BOARD_CHUNKS.find((candidate) => candidate.id === chunkId);
  if (!chunk) throw new Error(`fallback references unknown chunk "${chunkId}"`);
  return { chunk, grid: parseBoardRows(chunk.rows), flipped: false };
}

type AttemptFailure = { ok: false; reason: string };
type AttemptSuccess = { ok: true; cellMap: BoardCellMap; placements: Map<string, ZonePlacement> };

function placeZones(
  layout: BoardLayout,
  preset: GeneratedBoardPreset,
  cellMap: BoardCellMap,
  cellRng: SeededRandom,
  chunkRng: SeededRandom,
  forcedChunkByZone?: Record<string, string>,
): AttemptFailure | { ok: true; placements: Map<string, ZonePlacement> } {
  const placements = new Map<string, ZonePlacement>();

  for (const zone of layout.zones) {
    const requirement = computeZoneRequirement(zone, layout, preset.biome);
    const candidate = forcedChunkByZone
      ? resolveForcedCandidate(forcedChunkByZone[zone.id])
      : pickChunkForZone(BOARD_CHUNKS, requirement, chunkRng);

    if (!candidate) return { ok: false, reason: `no chunk available for zone "${zone.id}"` };
    placements.set(zone.id, materializeZoneChunk(zone, candidate, cellMap, cellRng));
  }

  return { ok: true, placements };
}

function collectMustBeReachableTargets(
  cellMap: BoardCellMap,
): { coord: IHexCoordinates; label: string }[] {
  const targets: { coord: IHexCoordinates; label: string }[] = [];
  for (const [key, cell] of cellMap.entries()) {
    if (cell.hexobject)
      targets.push({ coord: parseCoordinateKey(key), label: cell.hexobject.hexobjectKey });
  }
  return targets;
}

function attemptAssembly(
  layout: BoardLayout,
  preset: GeneratedBoardPreset,
  attemptSeedValue: string,
  forcedChunkByZone?: Record<string, string>,
): AttemptFailure | AttemptSuccess {
  const cellMap = new BoardCellMap();
  const chunkRng = deriveStream(attemptSeedValue, 'chunk');
  const cellRng = deriveStream(attemptSeedValue, 'cell');
  const doorRng = deriveStream(attemptSeedValue, 'doors');
  const slotRng = deriveStream(attemptSeedValue, 'slots');

  const zonesResult = placeZones(layout, preset, cellMap, cellRng, chunkRng, forcedChunkByZone);
  if (!zonesResult.ok) return zonesResult;
  const { placements } = zonesResult;

  carveAllLinks(layout, placements, cellMap, doorRng);
  placeEntryObject(layout, placements, preset.entryObject, cellMap);
  fillSlots(layout, [...placements.values()], preset, cellMap, slotRng);
  resolveDeepWallsToVoid(cellMap);

  const entryCoord = placements.get(layout.entryZone)?.entryCells[0];
  if (!entryCoord)
    return { ok: false, reason: `entry zone "${layout.entryZone}" produced no entry cell` };

  const reachability = checkGeneratedBoardReachable(
    cellMap,
    entryCoord,
    collectMustBeReachableTargets(cellMap),
  );
  if (!reachability.ok) return { ok: false, reason: reachability.reason };

  return { ok: true, cellMap, placements };
}

function finalizeBoard(
  result: AttemptSuccess,
  preset: GeneratedBoardPreset,
  layout: BoardLayout,
  seed: string,
  attempt: number,
): BuiltDungeonBoard {
  const map = assembleHexMapModel({
    boardColumns: BOARD_COLUMNS,
    boardRows: BOARD_ROWS,
    background: preset.background,
    cellAt: (coord) => result.cellMap.get(coord) ?? VOID_CELL,
  });

  const chunkByZone: Record<string, string> = {};
  for (const [zoneId, placement] of result.placements) chunkByZone[zoneId] = placement.chunkId;

  return {
    map,
    descriptor: {
      kind: 'DUNGEON',
      presetId: preset.id,
      seed,
      attempt,
      layoutId: layout.id,
      chunkByZone,
    },
  };
}

/** docs/WORLD-MAP-BOARDS-PLAN.md §3.4 — picks a layout, tries up to MAX_ATTEMPTS random chunk assignments, and falls back to the preset's vetted fallbackChunks if none pass every hard check (chunk availability, then reachability). */
export function assembleGeneratedBoard(
  seed: string,
  preset: GeneratedBoardPreset,
): BuiltDungeonBoard {
  const layout = pickLayout(preset, deriveStream(seed, 'layout'));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = attemptAssembly(layout, preset, attemptSeed(seed, attempt));
    if (result.ok) return finalizeBoard(result, preset, layout, seed, attempt);
  }

  const fallbackChunkByZone = preset.fallbackChunks[layout.id];
  if (!fallbackChunkByZone) {
    throw new Error(`preset "${preset.id}" has no fallbackChunks for layout "${layout.id}"`);
  }

  const result = attemptAssembly(
    layout,
    preset,
    attemptSeed(seed, MAX_ATTEMPTS),
    fallbackChunkByZone,
  );
  if (!result.ok) {
    throw new Error(
      `preset "${preset.id}" fallback for layout "${layout.id}" failed: ${result.reason}`,
    );
  }
  return finalizeBoard(result, preset, layout, seed, MAX_ATTEMPTS);
}
