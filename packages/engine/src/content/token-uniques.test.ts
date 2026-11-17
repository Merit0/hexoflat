import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { BASE_REALMS } from '../tokens/token-keys';
import { uniqueTokenDefinitionSchema, type UniqueTokenDefinition } from '../tokens/unique-schema';
import { UniqueRegistry } from '../tokens/registries';
import { TOKEN_ATTRIBUTES } from './token-attributes.content';
import { createTokenRegistries, tokenLocaleKeys } from './token-content';
import { TOKEN_UNIQUES } from './token-uniques.content';
import { TOKEN_WORDS } from './token-words.content';
import { uniqueContentFailures } from './validate-tokens';

const [GLOOM_SWORD, EXECUTOR_SWORD] = TOKEN_UNIQUES;

function withUnique(changes: Partial<UniqueTokenDefinition>): UniqueTokenDefinition[] {
  return [{ ...GLOOM_SWORD, ...changes }];
}

describe('word pools (D17)', () => {
  it('has at least 48 shared prefixes and 48 shared suffixes and keeps the realm words', () => {
    const shared = (words: readonly { realms?: unknown }[]) =>
      words.filter((word) => !word.realms).length;
    expect(shared(TOKEN_WORDS.prefixes)).toBeGreaterThanOrEqual(48);
    expect(shared(TOKEN_WORDS.suffixes)).toBeGreaterThanOrEqual(48);
    for (const realm of BASE_REALMS) {
      expect(TOKEN_WORDS.prefixes.filter((word) => word.realms?.includes(realm))).toHaveLength(2);
      expect(TOKEN_WORDS.suffixes.filter((word) => word.realms?.includes(realm))).toHaveLength(2);
    }
  });

  it('gives at least 2 304 names per realm', () => {
    const { words } = createTokenRegistries();
    for (const realm of BASE_REALMS) expect(words.combinations(realm)).toBeGreaterThanOrEqual(2304);
  });
});

describe('attribute units (D18)', () => {
  it('gives every attribute its unit', () => {
    expect(Object.fromEntries(TOKEN_ATTRIBUTES.map((a) => [a.key, a.unit]))).toEqual({
      heart: 'half-heart',
      shield: 'side',
      force: 'point',
      mass: 'point',
      will: 'point',
      fog: 'hex',
      bag: 'kg',
    });
  });
});

describe('unique token content', () => {
  it('passes the unique content check', () => {
    expect(uniqueContentFailures()).toEqual([]);
  });

  it('has a gloom sword with one fixed heart and one rolled attribute', () => {
    expect(GLOOM_SWORD).toMatchObject({
      type: 'sword',
      rarity: ERarityKind.GLOOM,
      attributes: [{ key: 'heart', value: 1 }],
      rolled: { attributes: 1 },
    });
  });

  it('has a god-executor sword with fixed attributes and no rolled part', () => {
    expect(EXECUTOR_SWORD.type).toBe('sword');
    expect(EXECUTOR_SWORD.rarity).toBe(ERarityKind.GOD_EXECUTOR);
    expect(EXECUTOR_SWORD.attributes.length).toBeGreaterThan(0);
    expect(EXECUTOR_SWORD.rolled).toBeUndefined();
  });

  it('lists the name and description keys of every unique among the locale keys', () => {
    const keys = tokenLocaleKeys();
    for (const unique of TOKEN_UNIQUES) {
      expect(keys).toContain(unique.name.nameKey);
      expect(keys).toContain(unique.descriptionKey);
    }
    expect(keys).toContain('content.tokens.realm.god-executor');
  });

  it.each<[string, Partial<UniqueTokenDefinition>, RegExp]>([
    ['an unknown type', { type: 'dragon-lance' }, /unknown type/],
    ['an unknown attribute', { attributes: [{ key: 'luck', value: 1 }] }, /luck is unknown/],
    ['a value above the tiers', { attributes: [{ key: 'heart', value: 3 }] }, /outside \[1, 2\]/],
    [
      'an attribute not allowed on the type',
      { attributes: [{ key: 'shield', value: 1 }] },
      /not allowed on type sword/,
    ],
    [
      'an attribute that is not implemented',
      { attributes: [{ key: 'force', value: 1 }] },
      /force is not implemented/,
    ],
    ['a broken schema', { price: 0 }, /price/],
  ])('reports %s', (_label, changes, message) => {
    expect(uniqueContentFailures(withUnique(changes)).join('\n')).toMatch(message);
  });

  it('refuses a broken definition in the schema and the registry', () => {
    const bad = (changes: Record<string, unknown>) =>
      uniqueTokenDefinitionSchema.safeParse({ ...GLOOM_SWORD, ...changes }).success;
    expect(bad({ name: { kind: 'generated', nameKey: GLOOM_SWORD.name.nameKey } })).toBe(false);
    expect(bad({ skills: ['not-a-skill'] })).toBe(false);
    expect(bad({ skills: ['b_strike', 'b_strike'] })).toBe(false);
    expect(bad({ rolled: { attributes: 3 } })).toBe(false);
    expect(bad({ price: 1.5 })).toBe(false);
    expect(bad({ attributes: [GLOOM_SWORD.attributes[0], GLOOM_SWORD.attributes[0]] })).toBe(false);
    expect(bad({ rarity: ERarityKind.GOD_EXECUTOR })).toBe(true);
    expect(() => new UniqueRegistry([GLOOM_SWORD, GLOOM_SWORD])).toThrow(/listed twice/);
    expect(() => new UniqueRegistry(TOKEN_UNIQUES).get('dragon-crown')).toThrow(/Unknown unique/);
  });
});
