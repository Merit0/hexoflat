import { z } from 'zod';
import { OPPOSITE_SIDE, type ExitSide } from '../../boards/exits';
import { LOCATION_KEYS, type LocationKey } from '../../registry/location-key';

export const AtlasPositionSchema = z.object({ x: z.number().int(), y: z.number().int() });
export type AtlasPosition = z.infer<typeof AtlasPositionSchema>;

export const BoardAtlasSchema = z
  .partialRecord(z.enum(LOCATION_KEYS), AtlasPositionSchema)
  .superRefine((atlas, ctx) => {
    const seen = new Map<string, string>();
    for (const [boardId, position] of Object.entries(atlas)) {
      if (!position) continue;
      const cell = `${position.x}:${position.y}`;
      const other = seen.get(cell);
      if (other) {
        ctx.addIssue({
          code: 'custom',
          message: `atlas boards "${other}" and "${boardId}" share position ${cell}`,
          path: [boardId],
        });
      }
      seen.set(cell, boardId);
    }
  });
export type BoardAtlas = z.infer<typeof BoardAtlasSchema>;

export const BOARD_ATLAS: BoardAtlas = {
  silesia: { x: 0, y: 0 },
  'silesia-north': { x: 0, y: -1 },
};

const SIDE_OFFSET: Record<ExitSide, AtlasPosition> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  E: { x: 1, y: 0 },
};

function atlasEntries(atlas: BoardAtlas): [LocationKey, AtlasPosition][] {
  return Object.entries(atlas).filter((entry): entry is [LocationKey, AtlasPosition] => !!entry[1]);
}

export function atlasNeighbour(
  boardId: string,
  side: ExitSide,
  atlas: BoardAtlas = BOARD_ATLAS,
): LocationKey | null {
  const here = atlasEntries(atlas).find(([id]) => id === boardId)?.[1];
  if (!here) return null;
  const target = { x: here.x + SIDE_OFFSET[side].x, y: here.y + SIDE_OFFSET[side].y };
  const found = atlasEntries(atlas).find(
    ([, position]) => position.x === target.x && position.y === target.y,
  );
  return found ? found[0] : null;
}

export function expectedExitSides(boardId: string, atlas: BoardAtlas = BOARD_ATLAS): ExitSide[] {
  return (Object.keys(SIDE_OFFSET) as ExitSide[]).filter((side) =>
    atlasNeighbour(boardId, side, atlas),
  );
}

export function arrivalSideFor(exitSide: ExitSide): ExitSide {
  return OPPOSITE_SIDE[exitSide];
}
