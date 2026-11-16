import type { BoardRecipeInput } from '../recipe-schema';
import { BATTLEFIELD_CRYPT_MODEL } from './battlefield-crypt';
import { TREASURE_SEEKER_MAP_MODEL } from './treasure-seeker-map';
import { CAVE_MODEL } from './cave';
import { TREASURE_SEEKER_MAP_KEY } from '../../../registry/quest-map-key';

export const BOARD_MODELS: Record<string, BoardRecipeInput> = {
  cave: CAVE_MODEL,
  'battlefield-crypt': BATTLEFIELD_CRYPT_MODEL,
  [TREASURE_SEEKER_MAP_KEY]: TREASURE_SEEKER_MAP_MODEL,
};
