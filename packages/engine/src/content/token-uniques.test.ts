import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { BASE_TOKEN_TYPES } from '../tokens/token-keys';
import { uniqueTokenDefinitionSchema, type UniqueTokenContent } from '../tokens/unique-schema';
import { UniqueRegistry } from '../tokens/registries';
import { tokenLocaleKeys } from './token-content';
import { TOKEN_UNIQUES } from './token-uniques.content';
import { TOKEN_WORDS } from './token-words.content';
import { uniqueContentFailures } from './validate-tokens';

const [GLOOM_SWORD, ALIEN_SWORD] = TOKEN_UNIQUES;

function withUnique(changes: Partial<UniqueTokenContent>): UniqueTokenContent[] {
  return [{ ...GLOOM_SWORD, ...changes }];
}

describe('word pools (D17)', () => {
  it('has at least 48 shared prefixes and 48 shared suffixes and keeps the tokenType words', () => {
    const shared = (words: readonly { tokenTypes?: unknown }[]) =>
      words.filter((word) => !word.tokenTypes).length;
    expect(shared(TOKEN_WORDS.prefixes)).toBeGreaterThanOrEqual(48);
    expect(shared(TOKEN_WORDS.suffixes)).toBeGreaterThanOrEqual(48);
    for (const tokenType of BASE_TOKEN_TYPES) {
      expect(
        TOKEN_WORDS.prefixes.filter((word) => word.tokenTypes?.includes(tokenType)),
      ).toHaveLength(2);
      expect(
        TOKEN_WORDS.suffixes.filter((word) => word.tokenTypes?.includes(tokenType)),
      ).toHaveLength(2);
    }
  });
});

describe('unique token content', () => {
  it('passes the unique content check', () => {
    expect(uniqueContentFailures()).toEqual([]);
  });

  it('has a gloom sword with one authored half-heart', () => {
    expect(GLOOM_SWORD).toMatchObject({
      type: 'sword',
      tokenType: ETokenType.GLOOM,
      authoredAttributes: [{ attribute: 'heart', min: 1, max: 1 }],
    });
    expect('rolled' in GLOOM_SWORD).toBe(false);
  });

  it('has an alien sword with authored attributes', () => {
    expect(ALIEN_SWORD.type).toBe('sword');
    expect(ALIEN_SWORD.tokenType).toBe(ETokenType.ALIEN);
    expect(ALIEN_SWORD.authoredAttributes.length).toBeGreaterThan(0);
    expect('rolled' in ALIEN_SWORD).toBe(false);
  });

  it('lists the name and description keys of every unique among the locale keys', () => {
    const keys = tokenLocaleKeys();
    for (const unique of TOKEN_UNIQUES) {
      expect(keys).toContain(unique.name.nameKey);
      expect(keys).toContain(unique.descriptionKey);
    }
    expect(keys).toContain('content.tokens.tokenType.alien');
  });

  it.each<[string, Partial<UniqueTokenContent>, RegExp]>([
    ['an unknown type', { type: 'dragon-lance' }, /unknown type/],
    [
      'an unknown attribute',
      { authoredAttributes: [{ attribute: 'luck', min: 1, max: 1 }] },
      /luck is not in the attribute catalogue/,
    ],
    [
      'a value above the itemMax',
      { authoredAttributes: [{ attribute: 'heart', min: 1, max: 11 }] },
      /above its itemMax 10/,
    ],
    [
      'an attribute that is not implemented',
      { authoredAttributes: [{ attribute: 'force', min: 1, max: 1 }] },
      /force is not implemented/,
    ],
    ['a broken schema', { price: 0 }, /price/],
  ])('reports %s', (_label, changes, message) => {
    expect(uniqueContentFailures(withUnique(changes)).join('\n')).toMatch(message);
  });

  it.each([
    ['min above max', { attribute: 'heart', min: 3, max: 2 }, 'min is above max'],
    [
      'an unknown attribute key',
      { attribute: 'luck', min: 1, max: 2 },
      'attribute luck is not in the attribute catalogue',
    ],
    ['a zero minimum', { attribute: 'heart', min: 0, max: 2 }, null],
    ['a fraction', { attribute: 'heart', min: 1, max: 1.5 }, null],
    ['an extra field', { attribute: 'heart', min: 1, max: 2, value: 1 }, null],
  ])('DA4b-4: the schema rejects an authored attribute with %s', (_label, entry, message) => {
    const parsed = uniqueTokenDefinitionSchema.safeParse({
      ...GLOOM_SWORD,
      authoredAttributes: [entry],
    });
    expect(parsed.success).toBe(false);
    if (message) expect(parsed.error!.issues.map((issue) => issue.message)).toContain(message);
    const valid = { attribute: 'heart', min: 2, max: 2 };
    expect(
      uniqueTokenDefinitionSchema.safeParse({ ...GLOOM_SWORD, authoredAttributes: [valid] })
        .success,
    ).toBe(true);
  });

  it('refuses a broken definition in the schema and the registry', () => {
    const bad = (changes: Record<string, unknown>) =>
      uniqueTokenDefinitionSchema.safeParse({ ...GLOOM_SWORD, ...changes }).success;
    expect(bad({ name: { kind: 'generated', nameKey: GLOOM_SWORD.name.nameKey } })).toBe(false);
    expect(bad({ skills: ['not-a-skill'] })).toBe(false);
    expect(bad({ skills: ['b_strike', 'b_strike'] })).toBe(false);
    expect(bad({ rolled: { attributes: 1 } })).toBe(false);
    expect(bad({ price: 1.5 })).toBe(false);
    const [heart] = GLOOM_SWORD.authoredAttributes;
    expect(bad({ authoredAttributes: [heart, heart] })).toBe(false);
    expect(bad({ attributes: [{ key: 'heart', value: 1 }] })).toBe(false);
    expect(bad({ tokenType: ETokenType.ALIEN })).toBe(false);
    expect(bad({ tokenType: ETokenType.ALIEN, dimension: 'nowhere' })).toBe(true);
    expect(() => new UniqueRegistry([GLOOM_SWORD, GLOOM_SWORD])).toThrow(/listed twice/);
    expect(() => new UniqueRegistry(TOKEN_UNIQUES).get('dragon-crown')).toThrow(/Unknown unique/);
  });
});
