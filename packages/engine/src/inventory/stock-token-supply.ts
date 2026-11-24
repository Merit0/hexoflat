import { tokenSourceIdOf } from '../tokens/game-tokens';
import { type DropContext } from '../tokens/drop-context';
import type { InventoryState } from './inventory-state';
import type { TokenSupply } from './apply-stock';

export function stockTokenSupply(
  inventory: InventoryState | undefined,
  source: { seed: string; sourceId: string; dropContext?: DropContext } | undefined,
): TokenSupply | undefined {
  if (!inventory || !source?.dropContext) return undefined;
  return {
    mint: {
      seed: source.seed,
      sourceId: tokenSourceIdOf(
        'grant',
        source.sourceId,
        inventory.heroId,
        String(inventory.idSeq),
      ),
      dropContext: source.dropContext,
    },
  };
}
