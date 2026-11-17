import { DEFAULT_TERRAIN, isTerrainPassable, type TerrainId } from '../boards/terrain';
import { TREASURE_SEEKER_MAP_MODEL } from '../content/boards/models/treasure-seeker-map';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import type { ServerWorld } from '../world/server-world';
import type { QuestRun, SeekerBoard, SeekerField } from './quest-state';
import { createTreasureField } from './treasure-field';

export interface SeekerFieldView extends SeekerBoard {
  background: string;
  exit: IHexCoordinates;
  blocked: { hex: IHexCoordinates; terrain: TerrainId }[];
  border: { hex: IHexCoordinates; objectKey: THexobjectKey }[];
}

export interface SeekerEntrance {
  field: SeekerField;
  start: IHexCoordinates;
}

function backgroundOf(world: ServerWorld, doorKey: string): string {
  const tiles = world.map.tiles;
  const ground = tiles.find(
    (tile) =>
      isTerrainPassable(tile.terrain) &&
      coordinateKey(tile.coordinates) !== doorKey &&
      tile.hexBackgroundImagePath,
  );
  return (
    ground?.hexBackgroundImagePath ||
    tiles.find((tile) => tile.hexBackgroundImagePath)?.hexBackgroundImagePath ||
    TREASURE_SEEKER_MAP_MODEL.background
  );
}

export function cloneOriginField(world: ServerWorld, door: IHexCoordinates): SeekerField {
  const doorKey = coordinateKey(door);
  return {
    origin: world.locationKey,
    background: backgroundOf(world, doorKey),
    exit: { columnIndex: door.columnIndex, rowIndex: door.rowIndex },
    tiles: world.map.tiles.map((tile) => {
      const hex = {
        columnIndex: tile.coordinates.columnIndex,
        rowIndex: tile.coordinates.rowIndex,
      };
      return tile.terrain === DEFAULT_TERRAIN ? { hex } : { hex, terrain: tile.terrain };
    }),
  };
}

export function seekerFieldView(field: SeekerField): SeekerFieldView {
  const exitKey = coordinateKey(field.exit);
  const floor: IHexCoordinates[] = [];
  const blocked: SeekerFieldView['blocked'] = [];
  for (const tile of field.tiles) {
    if (coordinateKey(tile.hex) === exitKey) continue;
    if (isTerrainPassable(tile.terrain)) floor.push(tile.hex);
    else blocked.push({ hex: tile.hex, terrain: tile.terrain ?? DEFAULT_TERRAIN });
  }
  return {
    floor,
    background: field.background,
    exit: field.exit,
    blocked,
    border: [{ hex: field.exit, objectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE }],
  };
}

function generatedFieldView(seed: string): SeekerFieldView {
  const field = createTreasureField(seed);
  return {
    floor: [...field.floor],
    background: field.map.tiles[0]?.hexBackgroundImagePath || TREASURE_SEEKER_MAP_MODEL.background,
    exit: field.exit,
    blocked: [],
    border: field.map.tiles.flatMap((tile) =>
      tile.regionId === 'border' && tile.hexobject
        ? [{ hex: tile.coordinates, objectKey: tile.hexobject.hexobjectKey }]
        : [],
    ),
  };
}

export function seekerBoardOf(run: Pick<QuestRun, 'field' | 'seed'>): SeekerFieldView {
  return run.field ? seekerFieldView(run.field) : generatedFieldView(run.seed);
}
