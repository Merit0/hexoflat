import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { createTokenRegistries, TOKEN_CONTENT, tokenLocaleKeys } from '../../content/token-content';
import { TOKEN_NAME_RULES, TOKEN_NAME_SHAPE_WEIGHTS } from '../../content/token-words.content';
import type { DescriptionLine, ItemToken, TokenName } from '../token-schema';
import { wordKeyOf } from '../token-keys';
import { createTokenFactory } from './create-token-factory';
import {
  contextFor,
  defaultFactory,
  EXTENSION_TEXTS,
  extendedContent,
  extendedManifest,
  mixedContexts,
} from './factory-test-setup';
import {
  flattenTextTree,
  formatTokenDescription,
  formatTokenName,
  type TokenDictionary,
} from './format-token';
import { letterCount, tokenNameRuleFailures } from './name-rules';
import type { GenerationContext } from './token-generation';

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../apps/web/src/locales',
);

function dictionaryOf(lang: string): TokenDictionary {
  return flattenTextTree(
    JSON.parse(readFileSync(path.join(LOCALES_DIR, lang, 'content.json'), 'utf-8')),
  );
}

const DICTIONARIES = { en: dictionaryOf('en'), uk: dictionaryOf('uk') };

function tokensOf(contexts: GenerationContext[], factory = defaultFactory): ItemToken[] {
  return contexts.map((ctx) => {
    const result = factory.createBase(ctx);
    if (!result.ok) throw new Error(result.refusal.message);
    return result.value;
  });
}

function nameId(name: TokenName): string {
  return JSON.stringify(name);
}

function shapeOf(name: TokenName): string {
  if (name.kind !== 'generated') return name.kind;
  if (name.prefix && name.suffix) return 'full';
  return name.prefix ? 'prefix' : 'suffix';
}

function diversity(tokens: ItemToken[]) {
  const counts = new Map<string, number>();
  for (const token of tokens)
    counts.set(nameId(token.name), (counts.get(nameId(token.name)) ?? 0) + 1);
  return { distinct: counts.size / tokens.length, most: Math.max(...counts.values()) };
}

const { types } = createTokenRegistries();
const NAMED_TYPES = types
  .all()
  .filter((type) => type.tool === null)
  .map((type) => type.key);

describe('token names and descriptions', () => {
  const tokens = tokensOf(mixedContexts(500, [undefined, ...types.all().map((type) => type.key)]));

  it.each(['en', 'uk'] as const)('TG-4: renders every name and description in %s', (lang) => {
    for (const token of tokens) {
      const name = formatTokenName(token.name, DICTIONARIES[lang]);
      expect(name.trim()).not.toBe('');
      expect(name).not.toMatch(/[{}]|content\./);
      for (const line of formatTokenDescription(token.description, DICTIONARIES[lang])) {
        expect(line.trim()).not.toBe('');
        expect(line).not.toMatch(/[{}]|content\./);
      }
    }
  });

  it.each(['en', 'uk'] as const)('TG-4: has %s text for every token locale key', (lang) => {
    for (const key of tokenLocaleKeys()) {
      expect(DICTIONARIES[lang][key]?.trim(), `${lang}: ${key}`).toBeTruthy();
    }
  });

  it('formats a generated name by the en and uk templates', () => {
    const name: TokenName = {
      kind: 'generated',
      prefix: wordKeyOf('prefix', 'ash'),
      noun: 'sword',
      suffix: wordKeyOf('suffix', 'warden'),
    };
    const en = DICTIONARIES.en;
    const uk = DICTIONARIES.uk;
    expect(formatTokenName(name, en)).toBe(
      `${en['content.tokens.suffix.warden']} ${en['content.tokens.prefix.ash']} Sword`,
    );
    expect(formatTokenName(name, uk)).toBe(
      `Меч ${uk['content.tokens.prefix.ash']} ${uk['content.tokens.suffix.warden']}`,
    );
    expect(formatTokenName({ kind: 'noun', noun: 'axe' }, uk)).toBe('Сокира');
  });

  it('formats the two-word names by their own en and uk templates', () => {
    const prefixed: TokenName = {
      kind: 'generated',
      prefix: wordKeyOf('prefix', 'ash'),
      noun: 'sword',
    };
    const suffixed: TokenName = {
      kind: 'generated',
      noun: 'sword',
      suffix: wordKeyOf('suffix', 'warden'),
    };
    const { en, uk } = DICTIONARIES;
    expect(formatTokenName(prefixed, en)).toBe(`${en['content.tokens.prefix.ash']} Sword`);
    expect(formatTokenName(suffixed, en)).toBe(`${en['content.tokens.suffix.warden']} Sword`);
    expect(formatTokenName(prefixed, uk)).toBe(`Меч ${uk['content.tokens.prefix.ash']}`);
    expect(formatTokenName(suffixed, uk)).toBe(`Меч ${uk['content.tokens.suffix.warden']}`);
  });

  it('formats the description lines with translated params', () => {
    const lines: DescriptionLine[] = [
      {
        key: 'content.tokens.line.kind',
        params: { type: 'content.tokens.noun.sword', realm: 'content.tokens.realm.gloom' },
      },
      { key: 'content.tokens.line.strike', params: { strike: 1 } },
      { key: 'content.tokens.attr.heart', params: { value: 0.5 } },
      { key: 'content.tokens.line.tier', params: { tier: 2 } },
    ];
    expect(formatTokenDescription(lines, DICTIONARIES.en)).toEqual([
      'Sword · Gloom',
      'Strike 1',
      'Hearts +0.5',
      'Tier 2',
    ]);
    expect(formatTokenDescription(lines, DICTIONARIES.uk)).toEqual([
      'Меч · Морок',
      'Удар 1',
      'Серця +0.5',
      'Рівень 2',
    ]);
  });

  it('throws on a missing text', () => {
    expect(() => formatTokenName({ kind: 'noun', noun: 'hammer' }, DICTIONARIES.en)).toThrow(
      /content\.tokens\.noun\.hammer/,
    );
  });

  it('TG-7: gives at least 40% distinct names in 500 mixed tokens, none more than 12 times', () => {
    const named = tokensOf(mixedContexts(500, NAMED_TYPES));
    const { distinct, most } = diversity(named);
    expect(distinct).toBeGreaterThanOrEqual(0.4);
    expect(most).toBeLessThanOrEqual(12);
  });

  it.each(
    [ERarityKind.GLOOM, ERarityKind.IDOL, ERarityKind.SPARK].flatMap((realm) =>
      NAMED_TYPES.map((type) => [realm, type] as const),
    ),
  )('TG-7: gives at least 25%% distinct names in 500 %s %s tokens', (realm, type) => {
    const tokens = tokensOf(
      Array.from({ length: 500 }, (_, index) => contextFor(index + 1, { realm, type })),
    );
    expect(diversity(tokens).distinct).toBeGreaterThanOrEqual(0.25);
  });
});

describe('generated name limits and shapes', () => {
  const named = tokensOf(mixedContexts(500, [undefined, ...types.all().map((type) => type.key)]));

  it.each(['en', 'uk'] as const)(
    'TG-4b: keeps every %s generated name within the word and letter limits',
    (lang) => {
      expect(tokenNameRuleFailures(TOKEN_CONTENT, DICTIONARIES[lang])).toEqual([]);
      for (const token of named.filter((token) => token.name.kind !== 'authored')) {
        const words = formatTokenName(token.name, DICTIONARIES[lang]).split(' ');
        expect(words.length).toBeLessThanOrEqual(TOKEN_NAME_RULES.maxWords);
        for (const word of words)
          expect(letterCount(word)).toBeLessThanOrEqual(TOKEN_NAME_RULES.maxWordLetters);
      }
    },
  );

  it('TG-4b: refuses a two-word word, a too long word and a long template', () => {
    const dictionary: TokenDictionary = {
      ...DICTIONARIES.en,
      'content.tokens.nameTemplate': '{suffix} {prefix} {noun} of old',
      'content.tokens.prefix.ash': 'Ashenwrapped',
      'content.tokens.suffix.warden': 'Long Night',
    };
    expect(tokenNameRuleFailures(TOKEN_CONTENT, dictionary)).toEqual([
      'content.tokens.nameTemplate: "{suffix} {prefix} {noun} of old" gives more than 3 words',
      'content.tokens.prefix.ash: "Ashenwrapped" has more than 10 letters',
      'content.tokens.suffix.warden: "Long Night" must be one word',
    ]);
  });

  it('counts letters only, so an apostrophe is free', () => {
    expect(letterCount("Smith's")).toBe(6);
    expect(letterCount("Кожум'яки")).toBe(8);
  });

  it('TG-7: gives a three-word name to about 10% of 5000 named tokens, two words to the rest', () => {
    const named = tokensOf(mixedContexts(5000, NAMED_TYPES));
    const total = Object.values(TOKEN_NAME_SHAPE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    for (const [shape, weight] of Object.entries(TOKEN_NAME_SHAPE_WEIGHTS)) {
      const share = named.filter((token) => shapeOf(token.name) === shape).length / named.length;
      expect(share, shape).toBeGreaterThan(weight / total - 0.03);
      expect(share, shape).toBeLessThan(weight / total + 0.03);
    }
  });
});

describe('TG-9: extension by data only', () => {
  const factory = createTokenFactory(extendedContent(), extendedManifest());
  const tokens = tokensOf(
    Array.from({ length: 300 }, (_, index) =>
      contextFor(index + 1, { realm: ERarityKind.SPARK, type: 'hammer' }),
    ),
    factory,
  );
  const extraLanguage: TokenDictionary = {
    ...Object.fromEntries(
      Object.keys(DICTIONARIES.en).map((key) => [key, `~${DICTIONARIES.en[key]}`]),
    ),
    'content.tokens.nameTemplate': '{suffix} / {noun} / {prefix}',
    'content.tokens.nameTemplatePrefix': '{noun} / {prefix}',
    'content.tokens.nameTemplateSuffix': '{suffix} / {noun}',
    ...EXTENSION_TEXTS,
  };

  it('makes tokens of the new type with its sprite, attribute and words', () => {
    expect(tokens.every((token) => token.type === 'hammer')).toBe(true);
    expect(tokens.every((token) => token.sprite === 'spark-hammer-01')).toBe(true);
    expect(tokens.some((token) => token.attributes.some((a) => a.key === 'ward'))).toBe(true);
    const names = tokens.map((token) => token.name);
    expect(names.some((name) => name.kind === 'generated' && name.prefix?.endsWith('.glass'))).toBe(
      true,
    );
    expect(
      names.some((name) => name.kind === 'generated' && name.suffix?.endsWith('.lighthouse')),
    ).toBe(true);
  });

  it('formats the new type in a new language', () => {
    for (const token of tokens) {
      expect(formatTokenName(token.name, extraLanguage)).toMatch(/^(.+ \/ )?Hammer( \/ .+)?$/);
      expect(formatTokenName(token.name, extraLanguage)).not.toBe('Hammer');
      expect(formatTokenDescription(token.description, extraLanguage)[0]).toBe('~Hammer · ~Spark');
    }
  });

  it('keeps the new attribute away from other types', () => {
    const swords = tokensOf(
      Array.from({ length: 100 }, (_, index) =>
        contextFor(index + 1, { realm: ERarityKind.SPARK, type: 'sword' }),
      ),
      factory,
    );
    expect(swords.some((token) => token.attributes.some((a) => a.key === 'ward'))).toBe(false);
  });
});
