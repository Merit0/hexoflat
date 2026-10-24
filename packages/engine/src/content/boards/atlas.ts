import { OPPOSITE_SIDE, type ExitSide } from '../../boards/exits';

export interface AtlasPosition {
  x: number;
  y: number;
}

export const BOARD_ATLAS: Record<string, AtlasPosition> = {
  silesia: { x: 0, y: 0 },
  'silesia-north': { x: 0, y: -1 },
};

const SIDE_OFFSET: Record<ExitSide, AtlasPosition> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  E: { x: 1, y: 0 },
};

export function atlasNeighbour(
  boardId: string,
  side: ExitSide,
  atlas: Record<string, AtlasPosition> = BOARD_ATLAS,
): string | null {
  const here = atlas[boardId];
  if (!here) return null;
  const target = { x: here.x + SIDE_OFFSET[side].x, y: here.y + SIDE_OFFSET[side].y };
  const found = Object.entries(atlas).find(
    ([, position]) => position.x === target.x && position.y === target.y,
  );
  return found ? found[0] : null;
}

export function expectedExitSides(
  boardId: string,
  atlas: Record<string, AtlasPosition> = BOARD_ATLAS,
): ExitSide[] {
  return (Object.keys(SIDE_OFFSET) as ExitSide[]).filter((side) =>
    atlasNeighbour(boardId, side, atlas),
  );
}

export function arrivalSideFor(exitSide: ExitSide): ExitSide {
  return OPPOSITE_SIDE[exitSide];
}
