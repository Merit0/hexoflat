import type { ETokenType } from '../abstraction/hexobject-abstraction';
import { SPRITE_FALLBACK_ORDER } from '../dimensions/dimensions';
import type { SpriteManifest } from './sprite-files';
import {
  PLACEHOLDER_SPRITE_KEY,
  type ItemTypeKey,
  type SpriteKey,
  type TBaseTokenType,
} from './token-keys';

export interface SpriteRef {
  key: SpriteKey;
  path: string;
}

export type SpriteResolution =
  | { step: 'own'; from: ETokenType; refs: readonly SpriteRef[] }
  | { step: 'borrowed'; from: TBaseTokenType; refs: readonly SpriteRef[] }
  | { step: 'placeholder'; from: null; refs: readonly [SpriteRef] };

export function placeholderRef(manifest: SpriteManifest): SpriteRef {
  return { key: PLACEHOLDER_SPRITE_KEY, path: manifest.placeholder };
}

export function resolveBaseSprites(
  manifest: SpriteManifest,
  tokenType: ETokenType,
  type: ItemTypeKey,
): SpriteResolution {
  const refsOf = (owner: ETokenType): SpriteRef[] =>
    manifest.entries.filter(
      (entry) => entry.tier === 'base' && entry.type === type && entry.tokenType === owner,
    );
  const own = refsOf(tokenType);
  if (own.length > 0) return { step: 'own', from: tokenType, refs: own };
  for (const from of SPRITE_FALLBACK_ORDER) {
    const refs = refsOf(from);
    if (refs.length > 0) return { step: 'borrowed', from, refs };
  }
  return { step: 'placeholder', from: null, refs: [placeholderRef(manifest)] };
}
