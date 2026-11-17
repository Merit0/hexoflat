import { TREASURE_SEEKER_MAP_MODEL } from '../content/boards/models/treasure-seeker-map';
import type { SeekerEntrance } from './origin-field';
import { createTreasureField } from './treasure-field';

export function generatedEntrance(seed: string): SeekerEntrance {
  const field = createTreasureField(seed);
  return {
    start: { ...field.start },
    field: {
      origin: 'silesia',
      background: TREASURE_SEEKER_MAP_MODEL.background,
      exit: { ...field.exit },
      tiles: [...field.floor, field.exit].map((hex) => ({ hex: { ...hex } })),
    },
  };
}
