import { tokenSourceIdOf } from '../tokens/game-tokens';
import { type TokenOrigin } from '../tokens/token-origin';
import type { InventoryState } from './inventory-state';
import type { TokenSupply } from './apply-stock';

export function stockTokenSupply(
  inventory: InventoryState | undefined,
  source: { seed: string; sourceId: string; origin?: TokenOrigin } | undefined,
): TokenSupply | undefined {
  if (!inventory || !source?.origin) return undefined;
  return {
    mint: {
      seed: source.seed,
      sourceId: tokenSourceIdOf(
        'grant',
        source.sourceId,
        inventory.heroId,
        String(inventory.idSeq),
      ),
      origin: source.origin,
    },
  };
}
