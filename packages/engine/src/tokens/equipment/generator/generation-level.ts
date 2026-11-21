import { mapTierSchema, type TMapTier } from '../../token-keys';

export const DEFAULT_GENERATION_LEVEL: TMapTier = 1;

function tierOrNull(value: number | null | undefined): TMapTier | null {
  const parsed = mapTierSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveGenerationLevel(
  containerLevel?: number | null,
  boardTier?: number | null,
): TMapTier {
  return tierOrNull(containerLevel) ?? tierOrNull(boardTier) ?? DEFAULT_GENERATION_LEVEL;
}
