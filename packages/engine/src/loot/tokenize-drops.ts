import { isTokenType, mintBaseToken, type TokenMint } from '../tokens/game-tokens';
import type { LootDrop } from './loot-table';

export function tokenizeLootLists(lists: readonly (readonly LootDrop[])[], mint: TokenMint) {
  let n = 0;
  return lists.map((list) =>
    list.flatMap((drop): LootDrop[] => {
      if (drop.token || !isTokenType(drop.itemKey)) {
        n += 1;
        return [{ ...drop }];
      }
      return Array.from({ length: drop.amount }, () => ({
        ...drop,
        amount: 1,
        token: mintBaseToken(mint, drop.itemKey, n++, drop.baseKey),
      }));
    }),
  );
}
