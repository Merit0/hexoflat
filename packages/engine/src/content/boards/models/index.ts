import type { BoardRecipeInput } from '../recipe-schema';
import { BATTLEFIELD_CRYPT_MODEL } from './battlefield-crypt';
import { CAVE_MODEL } from './cave';

export const BOARD_MODELS: Record<string, BoardRecipeInput> = {
  cave: CAVE_MODEL,
  'battlefield-crypt': BATTLEFIELD_CRYPT_MODEL,
};
