import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { TokenPriceRanges } from '../tokens/token-content-schema';

export const TOKEN_PRICE_RANGES: TokenPriceRanges = {
  [ERarityKind.GLOOM]: [60, 800],
  [ERarityKind.IDOL]: [40, 600],
  [ERarityKind.SPARK]: [100, 1200],
};
