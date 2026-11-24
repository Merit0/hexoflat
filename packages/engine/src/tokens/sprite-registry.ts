import type { ETokenType } from '../abstraction/hexobject-abstraction';
import type { TTokenTier } from '../dimensions/dimensions';
import {
  placeholderRef,
  resolveBaseSprites,
  type SpriteRef,
  type SpriteResolution,
} from './sprite-fallback';
import {
  spriteManifestSchema,
  type SpriteManifest,
  type SpriteManifestEntry,
} from './sprite-files';
import type { ItemTypeKey, UniqueKey } from './token-keys';
import { uniqueSpriteKey } from './unique-schema';

export class ManifestSpriteRegistry {
  private readonly manifest: SpriteManifest;
  private readonly placeholderSprite: SpriteRef;

  constructor(manifest: SpriteManifest) {
    this.manifest = spriteManifestSchema.parse(manifest);
    this.placeholderSprite = placeholderRef(this.manifest);
  }

  get placeholder(): SpriteRef {
    return this.placeholderSprite;
  }

  all(): readonly SpriteManifestEntry[] {
    return this.manifest.entries;
  }

  resolveBase(tokenType: ETokenType, type: ItemTypeKey): SpriteResolution {
    return resolveBaseSprites(this.manifest, tokenType, type);
  }

  spritesFor(tier: TTokenTier, tokenType: ETokenType, type: ItemTypeKey): readonly SpriteRef[] {
    return tier === 'base' ? this.resolveBase(tokenType, type).refs : [this.placeholderSprite];
  }

  uniqueSprite(uniqueKey: UniqueKey): SpriteRef {
    const key = uniqueSpriteKey(uniqueKey);
    const entry = this.manifest.entries.find(
      (candidate) => candidate.tier === 'unique' && candidate.key === key,
    );
    return entry ?? this.placeholderSprite;
  }
}
