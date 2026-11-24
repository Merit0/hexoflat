import { resolveBaseSprites } from './sprite-fallback';
import type { SpriteManifest } from './sprite-files';
import type { ItemTypeDefinition } from './token-content-schema';
import {
  BASE_TOKEN_TYPES,
  type ItemTypeKey,
  type TBaseTokenType,
  type UniqueKey,
} from './token-keys';
import { uniqueSpriteKey } from './unique-schema';

export interface SpriteCoverageContent {
  types: { all(): readonly Pick<ItemTypeDefinition, 'key' | 'tokenTypes'>[] };
  uniques: { all(): readonly { key: UniqueKey }[] };
}

export interface MissingBaseSprite {
  tokenType: TBaseTokenType;
  type: ItemTypeKey;
  uses: TBaseTokenType | null;
}

export interface SpriteCoverage {
  pairs: number;
  missingBase: MissingBaseSprite[];
  uniques: number;
  missingUniques: UniqueKey[];
}

export function spriteCoverage(
  manifest: SpriteManifest,
  content: SpriteCoverageContent,
): SpriteCoverage {
  const pairs = BASE_TOKEN_TYPES.flatMap((tokenType) =>
    content.types
      .all()
      .filter((type) => type.tokenTypes.includes(tokenType))
      .map((type) => ({ tokenType, type: type.key })),
  );
  const missingBase = pairs.flatMap((pair): MissingBaseSprite[] => {
    const resolution = resolveBaseSprites(manifest, pair.tokenType, pair.type);
    if (resolution.step === 'own') return [];
    return [{ ...pair, uses: resolution.from }];
  });
  const uniques = content.uniques.all().map((unique) => unique.key);
  const present = new Set(
    manifest.entries.filter((entry) => entry.tier === 'unique').map((entry) => entry.key),
  );
  return {
    pairs: pairs.length,
    missingBase,
    uniques: uniques.length,
    missingUniques: uniques.filter((key) => !present.has(uniqueSpriteKey(key))),
  };
}
