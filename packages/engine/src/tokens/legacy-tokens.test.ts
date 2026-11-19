import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { flattenTextTree, formatTokenDescription, formatTokenName } from './factory/format-token';
import { LEGACY_SHIELD, LEGACY_SWORD, LEGACY_TOKENS, LEGACY_UNIQUE } from './legacy-token-fixtures';
import { itemTokenSchema } from './token-schema';

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/src/locales',
);

function dictionaryOf(lang: string) {
  return flattenTextTree(
    JSON.parse(readFileSync(path.join(LOCALES_DIR, lang, 'content.json'), 'utf-8')),
  );
}

const DICTIONARIES = { en: dictionaryOf('en'), uk: dictionaryOf('uk') };

describe('saved generator v3 tokens (characterization)', () => {
  it('still pass the token schema unchanged', () => {
    for (const token of LEGACY_TOKENS) {
      expect(token.generatorVersion).toBe(3);
      expect(itemTokenSchema.parse(JSON.parse(JSON.stringify(token)))).toEqual(token);
    }
  });

  it.each([
    [LEGACY_SWORD, "Weaver's Bitter Sword", ['Sword · Gloom', 'Strike 1', 'Hearts +1', 'Tier 3']],
    [LEGACY_SHIELD, "Bridge's Shield", ['Shield · Gloom', 'Strike 0.5', 'Hearts +1', 'Tier 3']],
    [
      LEGACY_UNIQUE,
      'Lantern-Eater',
      [
        'Forged in a shaft where no lamp stayed lit.',
        'Sword · Gloom',
        'Strike 1',
        'Hearts +0.5',
        'Tier 3',
      ],
    ],
  ])('renders the English name and baked lines of %#', (token, name, lines) => {
    expect(formatTokenName(token.name, DICTIONARIES.en)).toBe(name);
    expect(formatTokenDescription(token.description, DICTIONARIES.en)).toEqual(lines);
  });

  it.each([
    [LEGACY_SWORD, 'Меч Полину Ткача', ['Меч · Морок', 'Удар 1', 'Серця +1', 'Рівень 3']],
    [LEGACY_SHIELD, 'Щит Мостаря', ['Щит · Морок', 'Удар 0.5', 'Серця +1', 'Рівень 3']],
    [
      LEGACY_UNIQUE,
      'Пожирач Ліхтарів',
      [
        'Викуваний у шахті, де не втримався жоден ліхтар.',
        'Меч · Морок',
        'Удар 1',
        'Серця +0.5',
        'Рівень 3',
      ],
    ],
  ])('renders the Ukrainian name and baked lines of %#', (token, name, lines) => {
    expect(formatTokenName(token.name, DICTIONARIES.uk)).toBe(name);
    expect(formatTokenDescription(token.description, DICTIONARIES.uk)).toEqual(lines);
  });
});
