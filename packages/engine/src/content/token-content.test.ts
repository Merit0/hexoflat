import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemShieldBase } from '../battle/shield-stats';
import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { BATTLE_ITEMS, battleItemOfHexobject } from '../battle/battle-catalogue';
import { BATTLE_RULES } from '../battle/battle-content';
import { EHexActionType } from '../enums/hex-action-type';
import { coinPriceOf } from './content-accessors';
import { ITEM_TYPES } from './item-types.content';
import { EQUIPMENT_ATTRIBUTES } from './equipment-attributes.content';
import { ATTRIBUTE_PROFILES } from './attribute-profiles.content';
import { createTokenRegistries, TOKEN_CONTENT, tokenLocaleKeys } from './token-content';
import { TOKEN_PRICE_RANGES } from './token-prices.content';
import { hasGeneratedName } from '../tokens/token-content-schema';
import { tokenContentFailures } from './validate-tokens';

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
  const { types } = createTokenRegistries();

  it('passes the token content check', () => {
    expect(tokenContentFailures()).toEqual([]);
  });

  it('reports a named type without an adjective of a band', () => {
    const noFine = {
      ...TOKEN_CONTENT,
      adjectives: TOKEN_CONTENT.adjectives.filter((adjective) => adjective.band !== 'fine'),
    };
    expect(tokenContentFailures(noFine).join('\n')).toMatch(/sword has no fine adjective/);
  });

  it('names tools only by their type and generates names for the rest', () => {
    const generated = types
      .all()
      .filter(hasGeneratedName)
      .map((type) => type.key);
    expect(generated).toEqual(['sword', 'shield']);
  });

  it('needs no adjective for tool types', () => {
    const toolsOnly = {
      ...TOKEN_CONTENT,
      baseItems: TOKEN_CONTENT.baseItems.filter((item) => ['axe', 'pickaxe'].includes(item.type)),
      types: TOKEN_CONTENT.types.filter((type) => type.tool !== null),
      adjectives: [],
    };
    expect(tokenContentFailures(toolsOnly)).toEqual([]);
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
    for (const lang of ['en', 'uk']) {
      expect(placeholders(localeText(lang, 'content.tokens.nameTemplateAdjective'))).toEqual([
        '{adjective}',
        '{noun}',
      ]);
    }
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
      shieldItem ? itemShieldBase({ key: shieldItem }).sides : undefined,
    );
  });

  it('binds the gathering tools to CUT and MINE with a wear of 0.1 per use', () => {
    expect(types.get('axe').tool).toEqual({ action: EHexActionType.CUT, durabilityCostPct: 0.1 });
    expect(types.get('pickaxe').tool).toEqual({
      action: EHexActionType.MINE,
      durabilityCostPct: 0.1,
    });
    expect(types.get('sword').tool).toBeNull();
  });

  it('lets the axe and the pickaxe into any hand, the sword and the shield into their own', () => {
    expect(types.get('axe').slot).toBe('any');
    expect(types.get('pickaxe').slot).toBe('any');
    expect(types.get('sword').slot).toBe('weapon');
    expect(types.get('shield').slot).toBe('shield');
  });

  it('keeps the current sword price inside the idol range', () => {
    const [min, max] = TOKEN_PRICE_RANGES[ETokenType.IDOL];
    expect(coinPriceOf('sword')).toBeGreaterThanOrEqual(min);
    expect(coinPriceOf('sword')).toBeLessThanOrEqual(max);
    expect(ETokenType.ALIEN in TOKEN_PRICE_RANGES).toBe(false);
  });
});

describe('implemented token attributes', () => {
  it('keeps the released pool and heart ranges in whole half-hearts', () => {
    expect(
      EQUIPMENT_ATTRIBUTES.filter((attribute) => attribute.implemented).map(
        (attribute) => attribute.key,
      ),
    ).toEqual([
      'heart',
      'shield',
      'will',
      'fog',
      'crit-chance',
      'crit-dmg',
      'trophy',
      'yield',
      'heal-on-block',
      'smart-step',
      'deft-hands',
      'wisdom',
    ]);
    expect(
      [1, 2, 3, 4].map((tier) => {
        const { min, max } = ATTRIBUTE_PROFILES[`tier-${tier as 1 | 2 | 3 | 4}`].attributes.heart;
        return [min, max];
      }),
    ).toEqual([
      [1, 2],
      [1, 4],
      [1, 6],
      [1, 8],
    ]);
  });
});
