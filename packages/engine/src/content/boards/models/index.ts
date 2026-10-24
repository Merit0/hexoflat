import type { BoardRecipeInput } from '../recipe-schema';
import { CAVE_MODEL } from './cave';

export const BOARD_MODELS: Record<string, BoardRecipeInput> = {
  cave: CAVE_MODEL,
};
