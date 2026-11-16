import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { axialToOffset, hexDistance, getHexNeighbors } from '../utils/hex-utils';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import type { PipelineBoard } from '../boards/pipeline/run-board-pipeline';
import type { SeekerBoard } from './quest-state';
import { TREASURE_SEEKER_MAP_MODEL } from '../content/boards/models/treasure-seeker-map';

const shape = TREASURE_SEEKER_MAP_MODEL.stages.form[0];
export const FIELD_RADIUS = shape.radius;
export const FIELD_CENTER = shape.center;

export interface TreasureField extends SeekerBoard {
  start: IHexCoordinates;
  exit: IHexCoordinates;
  map: PipelineBoard['map'];
  descriptor: PipelineBoard['descriptor'];
}

export function createTreasureField(seed: string): TreasureField {
  const generated = runBoardPipeline(TREASURE_SEEKER_MAP_MODEL, { seed });
  const floor = generated.regions.find((region) => region.id === 'field')!.cells;
  const start = generated.regions.find((region) => region.id === 'start')!.cells[0];
  const exit = generated.regions.find((region) => region.id === 'exit')!.cells[0];
  return { floor, start, exit, map: generated.map, descriptor: generated.descriptor };
}

export function questExitHex(start: IHexCoordinates): IHexCoordinates {
  const center = axialToOffset(FIELD_CENTER);
  const neighbours = getHexNeighbors(start);
  return (
    neighbours.find((hex) => hexDistance(center, hex) > FIELD_RADIUS) ??
    neighbours[neighbours.length - 1]
  );
}
