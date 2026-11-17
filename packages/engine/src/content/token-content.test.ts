import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { BATTLE_ITEMS, battleItemOfHexobject } from '../battle/battle-catalogue';
import { BATTLE_RULES } from '../battle/battle-content';
import { EHexActionType } from '../enums/hex-action-type';
import { coinPriceOf } from './content-accessors';
import { ITEM_TYPES } from './item-types.content';
import { TOKEN_ATTRIBUTES } from './token-attributes.content';
import { createTokenRegistries, TOKEN_CONTENT, tokenLocaleKeys } from './token-content';
import { TOKEN_PRICE_RANGES } from './token-prices.content';
import { TOKEN_NAME_MIN_COMBINATIONS, tokenContentFailures } from './validate-tokens';

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/src/locales',
);

function localeText(lang: string, key: string): unknown {
  const json: unknown = JSON.parse(
    readFileSync(path.join(LOCALES_DIR, lang, 'content.json'), 'utf-8'),
  );
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], json);
}

function catalogueStrike(typeKey: string): number {
  const itemId = battleItemOfHexobject(typeKey);
  return (itemId ? BATTLE_ITEMS[itemId]?.power : undefined) ?? BATTLE_RULES.unarmedPower;
}

describe('item token content', () => {
  const { types, words } = createTokenRegistries();

  it('passes the token content check', () => {
    expect(tokenContentFailures()).toEqual([]);
  });

  it('TG-8: gives at least 1000 prefix x suffix names for every realm and type', () => {
    for (const type of types.all()) {
      for (const realm of type.realms) {
        expect(words.combinations(realm), `${realm}+${type.key}`).toBeGreaterThanOrEqual(
          TOKEN_NAME_MIN_COMBINATIONS,
        );
      }
    }
  });

  it('TG-8: reports a realm with too few words', () => {
    const small = {
      ...TOKEN_CONTENT,
      words: {
        prefixes: TOKEN_CONTENT.words.prefixes.slice(0, 10),
        suffixes: TOKEN_CONTENT.words.suffixes,
      },
    };
    expect(tokenContentFailures(small).join('\n')).toMatch(/name combinations/);
  });

  it('has at least 32 prefixes and 32 suffixes in every realm', () => {
    for (const realm of [ERarityKind.GLOOM, ERarityKind.IDOL, ERarityKind.SPARK]) {
      expect(words.prefixes(realm).length).toBeGreaterThanOrEqual(32);
      expect(words.suffixes(realm).length).toBeGreaterThanOrEqual(32);
    }
  });

  it.each(['en', 'uk'])('every token word key has %s text', (lang) => {
    for (const key of tokenLocaleKeys()) {
      const text = localeText(lang, key);
      expect(typeof text === 'string' && text.trim().length > 0, `${lang}: ${key}`).toBe(true);
    }
  });

  it('builds the name template from the same placeholders in en and uk', () => {
    const placeholders = (text: unknown) =>
      String(text)
        .match(/\{\w+\}/g)
        ?.sort();
    expect(placeholders(localeText('en', 'content.tokens.nameTemplate'))).toEqual([
      '{noun}',
      '{prefix}',
      '{suffix}',
    ]);
    expect(placeholders(localeText('uk', 'content.tokens.nameTemplate'))).toEqual([
      '{noun}',
      '{prefix}',
      '{suffix}',
    ]);
  });

  it.each(ITEM_TYPES.map((type) => [type.key, type] as const))(
    'type.strike of %s equals the battle catalogue value',
    (key, type) => {
      expect(type.strike).toBe(catalogueStrike(key));
    },
  );

  it('gives the shield the block sides of its battle item', () => {
    const shieldItem = battleItemOfHexobject('shield');
    expect(types.get('shield').block?.sides).toBe(
      shieldItem ? BATTLE_ITEMS[shieldItem]?.shieldCapacity : undefined,
    );
  });

  it('binds the gathering tools to CUT and MINE', () => {
    expect(types.get('axe').tool).toEqual({ action: EHexActionType.CUT });
    expect(types.get('pickaxe').tool).toEqual({ action: EHexActionType.MINE });
    expect(types.get('sword').tool).toBeNull();
  });

  it('keeps the current sword price inside the idol range', () => {
    const [min, max] = TOKEN_PRICE_RANGES[ERarityKind.IDOL];
    expect(coinPriceOf('sword')).toBeGreaterThanOrEqual(min);
    expect(coinPriceOf('sword')).toBeLessThanOrEqual(max);
    expect(ERarityKind.GOD_EXECUTOR in TOKEN_PRICE_RANGES).toBe(false);
  });

  it('implements only the heart attribute, in whole half-hearts', () => {
    expect(
      TOKEN_ATTRIBUTES.filter((attribute) => attribute.implemented).map(
        (attribute) => attribute.key,
      ),
    ).toEqual(['heart']);
    expect(TOKEN_ATTRIBUTES.find((attribute) => attribute.key === 'heart')?.valueByTier).toEqual({
      1: 1,
      2: 1,
      3: 2,
      4: 2,
    });
    expect(TOKEN_ATTRIBUTES).toHaveLength(7);
  });
});
