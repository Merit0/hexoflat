import type { ERarityKind } from '../abstraction/hexobject-abstraction';
import {
  attributeDefinitionSchema,
  sharesTheme,
  itemTypeDefinitionSchema,
  wordPoolDataSchema,
  type AttributeDefinition,
  type ItemTypeDefinition,
  type TokenWord,
  type WordPoolData,
} from './token-content-schema';
import type { AttributeKey, ItemTypeKey } from './token-keys';

function indexByKey<T extends { key: string }>(
  kind: string,
  entries: readonly T[],
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const entry of entries) {
    if (byKey.has(entry.key)) throw new Error(`${kind} "${entry.key}" is listed twice`);
    byKey.set(entry.key, entry);
  }
  return byKey;
}

export class TypeRegistry {
  private readonly byKey: ReadonlyMap<string, ItemTypeDefinition>;

  constructor(definitions: readonly ItemTypeDefinition[]) {
    this.byKey = indexByKey(
      'Item type',
      definitions.map((definition) => itemTypeDefinitionSchema.parse(definition)),
    );
  }

  has(key: ItemTypeKey): boolean {
    return this.byKey.has(key);
  }

  get(key: ItemTypeKey): ItemTypeDefinition {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`Unknown item type "${key}"`);
    return definition;
  }

  all(): readonly ItemTypeDefinition[] {
    return [...this.byKey.values()];
  }

  forRealm(realm: ERarityKind): readonly ItemTypeDefinition[] {
    return this.all().filter((definition) => (definition.realms as ERarityKind[]).includes(realm));
  }
}

export class AttributeRegistry {
  private readonly byKey: ReadonlyMap<string, AttributeDefinition>;

  constructor(definitions: readonly AttributeDefinition[]) {
    this.byKey = indexByKey(
      'Attribute',
      definitions.map((definition) => attributeDefinitionSchema.parse(definition)),
    );
  }

  has(key: AttributeKey): boolean {
    return this.byKey.has(key);
  }

  get(key: AttributeKey): AttributeDefinition {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`Unknown attribute "${key}"`);
    return definition;
  }

  all(): readonly AttributeDefinition[] {
    return [...this.byKey.values()];
  }

  generatableFor(type: ItemTypeKey): readonly AttributeDefinition[] {
    return this.all().filter(
      (definition) =>
        definition.implemented &&
        (!definition.allowedTypes?.length || definition.allowedTypes.includes(type)),
    );
  }
}

function inRealm(word: TokenWord, realm: ERarityKind): boolean {
  return !word.realms || (word.realms as ERarityKind[]).includes(realm);
}

export class WordPool {
  private readonly data: WordPoolData;

  constructor(data: WordPoolData) {
    const parsed = wordPoolDataSchema.parse(data);
    indexByKey('Word', [...parsed.prefixes, ...parsed.suffixes]);
    this.data = parsed;
  }

  prefixes(realm: ERarityKind): readonly TokenWord[] {
    return this.data.prefixes.filter((word) => inRealm(word, realm));
  }

  suffixes(realm: ERarityKind): readonly TokenWord[] {
    return this.data.suffixes.filter((word) => inRealm(word, realm));
  }

  suffixesAfter(realm: ERarityKind, prefix: TokenWord): readonly TokenWord[] {
    return this.suffixes(realm).filter((suffix) => !sharesTheme(prefix, suffix));
  }

  combinations(realm: ERarityKind): number {
    return this.prefixes(realm).reduce(
      (total, prefix) => total + this.suffixesAfter(realm, prefix).length,
      0,
    );
  }

  keys(): readonly string[] {
    return [...this.data.prefixes, ...this.data.suffixes].map((word) => word.key);
  }
}
