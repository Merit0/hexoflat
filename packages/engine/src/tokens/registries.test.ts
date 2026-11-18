import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { TOKEN_ATTRIBUTES } from '../content/token-attributes.content';
import { TOKEN_WORDS } from '../content/token-words.content';
import { AttributeRegistry, TypeRegistry, WordPool } from './registries';

describe('TypeRegistry', () => {
  const registry = new TypeRegistry(ITEM_TYPES);

  it('reads a type by key', () => {
    expect(registry.get('shield').block).toEqual({ sides: 1 });
  });

  it('refuses an unknown type', () => {
    expect(() => registry.get('dragon-lance')).toThrow(/Unknown item type/);
  });

  it('refuses a type listed twice', () => {
    expect(() => new TypeRegistry([ITEM_TYPES[0], ITEM_TYPES[0]])).toThrow(/listed twice/);
  });

  it('lists the types of a realm', () => {
    expect(registry.forRealm(ERarityKind.IDOL).map((type) => type.key)).toEqual([
      'sword',
      'shield',
      'axe',
      'pickaxe',
    ]);
    expect(registry.forRealm(ERarityKind.GOD_EXECUTOR)).toEqual([]);
  });
});

describe('AttributeRegistry', () => {
  const registry = new AttributeRegistry(TOKEN_ATTRIBUTES);

  it('offers only implemented attributes for generation', () => {
    expect(registry.generatableFor('shield').map((attribute) => attribute.key)).toEqual(['heart']);
  });

  it('keeps the stub attributes readable', () => {
    expect(registry.get('fog').implemented).toBe(false);
  });
});

describe('WordPool', () => {
  const pool = new WordPool(TOKEN_WORDS);

  it('keeps realm-tagged words in their realm', () => {
    const gloom = pool.prefixes(ERarityKind.GLOOM).map((word) => word.key);
    expect(gloom).toContain('content.tokens.prefix.deep');
    expect(gloom).not.toContain('content.tokens.prefix.clay');
  });

  it('refuses a word listed twice', () => {
    const word = { key: 'content.tokens.prefix.ash' };
    expect(() => new WordPool({ prefixes: [word, word], suffixes: [] })).toThrow(/listed twice/);
  });
});
