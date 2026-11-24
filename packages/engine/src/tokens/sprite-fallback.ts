import type { ETokenType } from '../abstraction/hexobject-abstraction';
import { SPRITE_FALLBACK_ORDER } from '../dimensions/dimensions';
import { deriveStream } from '../utils/random-seeded';
import type { SpriteManifest } from './sprite-files';
import { reportSpriteFallback } from './sprite-fallback-log';
import type { ItemToken } from './token-schema';
import {
  PLACEHOLDER_SPRITE_KEY,
  uniqueSpriteKey,
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

function pickByTokenId(refs: readonly SpriteRef[], tokenId: string): SpriteRef {
  if (refs.length === 1) return refs[0];
  return refs[Math.floor(deriveStream(tokenId, 'sprite')() * refs.length)];
}

function uniqueSprite(manifest: SpriteManifest, uniqueKey: string | undefined): SpriteRef {
  const key = uniqueKey === undefined ? null : uniqueSpriteKey(uniqueKey);
  const entry = manifest.entries.find(
    (candidate) => candidate.tier === 'unique' && candidate.key === key,
  );
  return entry ?? placeholderRef(manifest);
}

export function resolveTokenSprite(manifest: SpriteManifest, token: ItemToken): SpriteRef {
  if (token.tier === 'unique') return uniqueSprite(manifest, token.uniqueKey);
  const resolution = resolveBaseSprites(manifest, token.tokenType, token.type);
  reportSpriteFallback(token.tokenType, token.type, resolution);
  const stored =
    resolution.step === 'own' ? resolution.refs.find((ref) => ref.key === token.sprite) : undefined;
  return stored ?? pickByTokenId(resolution.refs, token.id);
}
