import { ITEM_TYPES } from '../content/item-types.content';
import { createTokenFactory } from './factory/create-token-factory';
import type { TokenFactory } from './factory/token-factory';
export { tokenSourceIdOf } from './source-id';
import type { DropContext } from './drop-context';
import type { ItemToken } from './token-schema';

export interface TokenMint {
  seed: string;
  sourceId: string;
  dropContext: DropContext;
  factory?: TokenFactory;
}

const TOKEN_TYPES: ReadonlySet<string> = new Set(ITEM_TYPES.map((type) => type.key));

let factory: TokenFactory | null = null;

export function gameTokenFactory(): TokenFactory {
  factory ??= createTokenFactory();
  return factory;
}

export function isTokenType(key: string): boolean {
  return TOKEN_TYPES.has(key);
}

export function mintBaseToken(
  mint: TokenMint,
  type: string,
  n: number,
  baseKey?: string,
): ItemToken {
  const result = (mint.factory ?? gameTokenFactory()).createBase({
    seed: mint.seed,
    sourceId: mint.sourceId,
    n,
    tokenType: mint.dropContext.tokenType,
    mapTier: mint.dropContext.mapTier,
    type,
    baseKey,
  });
  if (!result.ok) throw new Error(`TOKEN_REFUSED:${result.refusal.code}:${result.refusal.message}`);
  return result.value;
}
