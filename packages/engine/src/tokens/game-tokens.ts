import { ITEM_TYPES } from '../content/item-types.content';
import { createTokenFactory } from './factory/create-token-factory';
import type { TokenFactory } from './factory/token-factory';
import type { TTokenSourceKind } from './token-keys';
import type { TokenOrigin } from './token-origin';
import type { ItemToken } from './token-schema';

export interface TokenMint {
  seed: string;
  sourceId: string;
  origin: TokenOrigin;
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

function sourcePart(value: string): string {
  const part = value.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return part.length > 0 ? part : 'x';
}

export function tokenSourceIdOf(kind: TTokenSourceKind, ...parts: string[]): string {
  return `${kind}:${parts.map(sourcePart).join('.')}`;
}

export function mintBaseToken(mint: TokenMint, type: string, n: number): ItemToken {
  const result = gameTokenFactory().createBase({
    seed: mint.seed,
    sourceId: mint.sourceId,
    n,
    realm: mint.origin.realm,
    mapTier: mint.origin.mapTier,
    type,
  });
  if (!result.ok) throw new Error(`TOKEN_REFUSED:${result.refusal.code}:${result.refusal.message}`);
  return result.value;
}
