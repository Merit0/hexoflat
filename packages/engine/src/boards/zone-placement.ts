import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { BoardEdge, BoardLayout, BoardZone, LegendEntry } from '../content/boards/schemas';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { ChunkPlacementCandidate, ChunkRequirement } from './chunk-placement';
import { zoneToFrameCoord } from './layout-zones';
import { GROUND_CELL, type ResolvedCell } from './resolved-cell';
import { BoardCellMap } from './board-cell-map';
import {
  DOOR_SYMBOL,
  ENEMY_SLOT_SYMBOL,
  ENTRY_SYMBOL,
  GROUND_SYMBOL,
  POI_SLOT_SYMBOL,
  RANDOM_SYMBOL,
  RESOURCE_SLOT_SYMBOL,
  WALL_SYMBOL,
} from './board-symbols';

const WALL_CELL: ResolvedCell = {
  exists: true,
  hexobject: { hexobjectKey: HEXOBJECT_KEYS.STONE_WALL },
};

export function computeZoneRequirement(
  zone: BoardZone,
  layout: BoardLayout,
  biome: string,
): ChunkRequirement {
  const doorsNeededByEdge: Partial<Record<BoardEdge, number>> = {};
  const addDoor = (edge: BoardEdge) => {
    doorsNeededByEdge[edge] = (doorsNeededByEdge[edge] ?? 0) + 1;
  };

  for (const link of layout.links) {
    if (link.from === zone.id) addDoor(link.fromEdge);
    if (link.to === zone.id) addDoor(link.toEdge);
  }

  return {
    biome,
    width: zone.width,
    height: zone.height,
    doorsNeededByEdge,
    needsEntrySlot: layout.entryZone === zone.id,
  };
}

export interface ZonePlacement {
  zoneId: string;
  chunkId: string;
  doorCellsByEdge: Partial<Record<BoardEdge, IHexCoordinates[]>>;
  resourceSlotCells: IHexCoordinates[];
  poiSlotCells: IHexCoordinates[];
  enemySlotCells: IHexCoordinates[];
  entryCells: IHexCoordinates[];
}

/** Writes a chosen chunk's cells into `cellMap` at the zone's frame position, and reports back every marker cell (doors, slots, entry) the caller still needs to resolve. */
export function materializeZoneChunk(
  zone: BoardZone,
  candidate: ChunkPlacementCandidate,
  cellMap: BoardCellMap,
  rng: () => number,
): ZonePlacement {
  const placement: ZonePlacement = {
    zoneId: zone.id,
    chunkId: candidate.chunk.id,
    doorCellsByEdge: {},
    resourceSlotCells: [],
    poiSlotCells: [],
    enemySlotCells: [],
    entryCells: [],
  };

  for (let row = 0; row < zone.height; row += 1) {
    for (let column = 0; column < zone.width; column += 1) {
      const symbol = candidate.grid[row][column];
      const coord = zoneToFrameCoord(zone, column, row);
      const edges = localCellEdges(column, row, zone.width, zone.height);
      applyChunkSymbol(symbol, coord, edges, candidate.chunk.legend, cellMap, placement, rng);
    }
  }

  return placement;
}

/** A border cell belongs to the edge(s) its local position touches — a non-corner door touches exactly one. */
function localCellEdges(column: number, row: number, width: number, height: number): BoardEdge[] {
  const edges: BoardEdge[] = [];
  if (row === 0) edges.push('N');
  if (row === height - 1) edges.push('S');
  if (column === 0) edges.push('W');
  if (column === width - 1) edges.push('E');
  return edges;
}

function applyChunkSymbol(
  symbol: string,
  coord: IHexCoordinates,
  edges: BoardEdge[],
  legend: Record<string, LegendEntry> | undefined,
  cellMap: BoardCellMap,
  placement: ZonePlacement,
  rng: () => number,
): void {
  switch (symbol) {
    case GROUND_SYMBOL:
      cellMap.set(coord, GROUND_CELL);
      return;
    case WALL_SYMBOL:
      cellMap.set(coord, WALL_CELL);
      return;
    case RANDOM_SYMBOL:
      cellMap.set(coord, rng() < 0.5 ? GROUND_CELL : WALL_CELL);
      return;
    case DOOR_SYMBOL: {
      cellMap.set(coord, WALL_CELL);
      for (const edge of edges) {
        placement.doorCellsByEdge[edge] = [...(placement.doorCellsByEdge[edge] ?? []), coord];
      }
      return;
    }
    case ENTRY_SYMBOL:
      cellMap.set(coord, GROUND_CELL);
      placement.entryCells.push(coord);
      return;
    case RESOURCE_SLOT_SYMBOL:
      cellMap.set(coord, GROUND_CELL);
      placement.resourceSlotCells.push(coord);
      return;
    case POI_SLOT_SYMBOL:
      cellMap.set(coord, GROUND_CELL);
      placement.poiSlotCells.push(coord);
      return;
    case ENEMY_SLOT_SYMBOL:
      cellMap.set(coord, GROUND_CELL);
      placement.enemySlotCells.push(coord);
      return;
    default: {
      const legendEntry = legend?.[symbol];
      if (!legendEntry) throw new Error(`chunk cell "${symbol}" has no legend entry`);
      cellMap.set(coord, { exists: true, hexobject: legendEntry });
    }
  }
}
