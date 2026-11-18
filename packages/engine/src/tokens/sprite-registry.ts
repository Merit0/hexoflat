import type { ERarityKind } from '../abstraction/hexobject-abstraction';
import {
  PLACEHOLDER_SPRITE_KEY,
  spriteManifestSchema,
  type SpriteManifest,
  type SpriteManifestEntry,
} from './sprite-files';
import type { ItemTypeKey, TTokenOrigin, UniqueKey } from './token-keys';
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

  spritesFor(origin: TTokenOrigin, realm: ERarityKind, type: ItemTypeKey): readonly SpriteRef[] {
    const ofType = this.entries.filter((entry) => entry.origin === origin && entry.type === type);
    const exact = ofType.filter((entry) => entry.realm === realm);
    if (exact.length > 0) return exact;
    if (ofType.length > 0) return ofType;
    return [this.placeholderRef];
  }

  uniqueSprite(uniqueKey: UniqueKey): SpriteRef {
    const key = uniqueSpriteKey(uniqueKey);
    const entry = this.entries.find(
      (candidate) => candidate.origin === 'unique' && candidate.key === key,
    );
    return entry ?? this.placeholderRef;
  }

  missingUniqueSprites(uniqueKeys: readonly UniqueKey[]): UniqueKey[] {
    return uniqueKeys.filter((key) => this.uniqueSprite(key) === this.placeholderRef);
  }
}
