import type { ETokenType } from '../abstraction/hexobject-abstraction';
import {
  PLACEHOLDER_SPRITE_KEY,
  spriteManifestSchema,
  type SpriteManifest,
  type SpriteManifestEntry,
} from './sprite-files';
import type { TTokenTier } from '../dimensions/dimensions';
import type { ItemTypeKey, UniqueKey } from './token-keys';
import { uniqueSpriteKey } from './unique-schema';

export interface SpriteRef {
  key: string;
  path: string;
}

export class ManifestSpriteRegistry {
  private readonly entries: readonly SpriteManifestEntry[];
  private readonly placeholderRef: SpriteRef;

  constructor(manifest: SpriteManifest) {
    const parsed = spriteManifestSchema.parse(manifest);
    this.entries = parsed.entries;
    this.placeholderRef = { key: PLACEHOLDER_SPRITE_KEY, path: parsed.placeholder };
  }

  get placeholder(): SpriteRef {
    return this.placeholderRef;
  }

  all(): readonly SpriteManifestEntry[] {
    return this.entries;
  }

  spritesFor(tier: TTokenTier, tokenType: ETokenType, type: ItemTypeKey): readonly SpriteRef[] {
    const ofType = this.entries.filter((entry) => entry.tier === tier && entry.type === type);
    const exact = ofType.filter((entry) => entry.tokenType === tokenType);
    if (exact.length > 0) return exact;
    if (ofType.length > 0) return ofType;
    return [this.placeholderRef];
  }

  uniqueSprite(uniqueKey: UniqueKey): SpriteRef {
    const key = uniqueSpriteKey(uniqueKey);
    const entry = this.entries.find(
      (candidate) => candidate.tier === 'unique' && candidate.key === key,
    );
    return entry ?? this.placeholderRef;
  }

  missingUniqueSprites(uniqueKeys: readonly UniqueKey[]): UniqueKey[] {
    return uniqueKeys.filter((key) => this.uniqueSprite(key) === this.placeholderRef);
  }
}
