import { isTokenType, mintBaseToken, type TokenMint } from '../tokens/game-tokens';
import type { DropContext } from '../tokens/drop-context';
import type { LootDrop } from './loot-table';

export function tokenizeLootLists(
  lists: readonly (readonly LootDrop[])[],
  mint: TokenMint,
  listContexts: readonly DropContext[] = [],
) {
  let n = 0;
  return lists.map((list, index) => {
    const listMint = { ...mint, dropContext: listContexts[index] ?? mint.dropContext };
    return list.flatMap((drop): LootDrop[] => {
      if (drop.token || !isTokenType(drop.itemKey)) {
        n += 1;
        return [{ ...drop }];
      }
      return Array.from({ length: drop.amount }, () => ({
        ...drop,
        amount: 1,
        token: mintBaseToken(listMint, drop.itemKey, n++, drop.baseKey),
      }));
    });
  });
}
