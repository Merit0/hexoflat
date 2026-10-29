import { z } from 'zod';
import { objectKeysWithTag } from '../../../content/content-accessors';
import { isSquadKey } from '../../../content/squad-keys';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { coordinateKey, getHexNeighbors, hexDistance } from '../../../utils/hex-utils';
import { parseCoordinateKey } from '../../board-cell-map';
import { isFloor, shuffled } from '../piece-utils';
import type { BoardDraft, Piece } from '../types';
import { findEntryCoord, floorStepsFrom } from './rules';
import type { SeededRandom } from '../../../utils/random-seeded';

export const SQUAD_SPOTS = ['treasure', 'chokepoint', 'dead-end', 'deep'] as const;
type Spot = (typeof SQUAD_SPOTS)[number];

const SquadsParams = z.object({
  kind: z.literal('squads'),
  spacing: z.number().int().min(1).default(3),
  place: z
    .array(
      z.object({
        squad: z.string().refine(isSquadKey, { message: 'unknown squad' }),
        spot: z.enum(SQUAD_SPOTS),
        minSteps: z.number().int().min(1).default(3),
      }),
    )
    .min(1),
});
type Params = z.infer<typeof SquadsParams>;
type Placement = Params['place'][number];

function floorNeighbours(draft: BoardDraft, cell: IHexCoordinates): number {
  return getHexNeighbors(cell).filter((n) => isFloor(draft, n)).length;
}

function nextToTreasure(draft: BoardDraft, cell: IHexCoordinates): boolean {
  const treasure = new Set<string>(objectKeysWithTag('treasure'));
  return getHexNeighbors(cell).some((n) => {
    const key = draft.cellMap.get(n)?.hexobject?.hexobjectKey;
    return !!key && treasure.has(key);
  });
}

function fitsSpot(draft: BoardDraft, cell: IHexCoordinates, spot: Spot): boolean {
  if (spot === 'treasure') return nextToTreasure(draft, cell);
  if (spot === 'chokepoint') return floorNeighbours(draft, cell) === 2;
  if (spot === 'dead-end') return floorNeighbours(draft, cell) === 1;
  return true;
}

function freeCells(draft: BoardDraft, steps: Map<string, number>, placement: Placement) {
  return [...draft.cellMap.entries()]
    .filter(([, cell]) => !cell.hexobject)
    .map(([key]) => parseCoordinateKey(key))
    .filter((cell) => isFloor(draft, cell))
    .filter((cell) => (steps.get(coordinateKey(cell)) ?? -1) >= placement.minSteps);
}

function pickCell(
  draft: BoardDraft,
  placement: Placement,
  candidates: IHexCoordinates[],
  steps: Map<string, number>,
  rng: SeededRandom,
): IHexCoordinates | undefined {
  const spotted = candidates.filter((cell) => fitsSpot(draft, cell, placement.spot));
  const pool = shuffled(spotted.length ? spotted : candidates, rng);
  if (placement.spot !== 'deep') return pool[0];
  const depth = (cell: IHexCoordinates) => steps.get(coordinateKey(cell)) ?? 0;
  return pool.reduce<IHexCoordinates | undefined>(
    (best, cell) => (!best || depth(cell) > depth(best) ? cell : best),
    undefined,
  );
}

export const objectsSquads: Piece<Params> = {
  id: 'squads',
  schema: SquadsParams,
  tableRule:
    'For each listed enemy group, put its stack on a free floor tile at least the stated number of steps from the entrance and well apart from other groups — next to the treasure, in a narrow passage, at a dead end or as deep as possible; if no such tile exists, any free tile far enough will do.',
  run(draft, params, ctx) {
    const entry = findEntryCoord(draft);
    if (!entry) return;
    const steps = floorStepsFrom(draft, entry);
    const placed: IHexCoordinates[] = [];
    for (const placement of params.place) {
      const candidates = freeCells(draft, steps, placement).filter((cell) =>
        placed.every((other) => hexDistance(other, cell) > params.spacing),
      );
      const cell = pickCell(draft, placement, candidates, steps, ctx.rng);
      if (!cell) {
        draft.trace.recordShortfall({
          ruleId: `squad:${placement.squad}`,
          wanted: 1,
          placed: 0,
          reason: 'no free floor tile far enough from the entrance and other groups',
          required: true,
        });
        continue;
      }
      const previous = draft.cellMap.get(cell);
      draft.cellMap.set(cell, {
        ...previous,
        exists: true,
        hexobject: { hexobjectKey: placement.squad },
      });
      placed.push(cell);
      draft.trace.record(cell, {
        stage: 'objects',
        pieceId: 'squads',
        ruleId: `squad:${placement.squad}`,
        note: placement.squad,
      });
    }
  },
};
