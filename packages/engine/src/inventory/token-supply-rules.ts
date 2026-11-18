import { isTokenType } from '../tokens/game-tokens';
import { itemTokenIdOf } from '../tokens/token-keys';
import { itemTokenSchema } from '../tokens/token-schema';
import type { InventoryState } from './inventory-state';
import type { TokenSupply } from './apply-stock';

export function tokenSupplyFailure(
  state: InventoryState,
  key: string,
  amount: number,
  supply?: TokenSupply,
): string | null {
  if (!Number.isSafeInteger(amount) || amount < 1) return 'INVALID_AMOUNT';
  if (!isTokenType(key)) return supply?.tokens?.some(Boolean) ? 'INVALID_TOKEN' : null;
  const ids = new Set(
    [...state.bag, ...Object.values(state.equip), ...state.stash.cells].flatMap((cell) =>
      cell?.token ? [cell.token.id] : [],
    ),
  );
  // Gear occupies one bag cell per token. The placement planner rejects larger batches.
  for (let index = 0; index < Math.min(amount, state.bag.length); index++) {
    const token = supply?.tokens?.[index];
    if (!token) {
      if (!supply?.mint?.seed.trim()) return 'TOKEN_SOURCE_REQUIRED';
      const id = itemTokenIdOf(supply.mint.sourceId, index);
      if (ids.has(id)) return 'DUPLICATE_TOKEN';
      ids.add(id);
      continue;
    }
    if (token.type !== key || !itemTokenSchema.safeParse(token).success) return 'INVALID_TOKEN';
    if (ids.has(token.id)) return 'DUPLICATE_TOKEN';
    ids.add(token.id);
  }
  return null;
}
