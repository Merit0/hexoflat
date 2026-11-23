import { DIMENSION_TIERS } from '../dimensions/dimensions';
import type { TokenPriceRanges } from '../tokens/token-content-schema';

export const TOKEN_PRICE_RANGES: TokenPriceRanges = Object.fromEntries(
  DIMENSION_TIERS.flatMap((view) =>
    view.price.kind === 'range' ? [[view.tokenType, [...view.price.range]]] : [],
  ),
) as TokenPriceRanges;
