import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DIMENSION_TIERS, EDimension } from '../dimensions/dimensions';
import { flattenTextTree } from '../tokens/factory/format-token';
import { BASIS_POINTS } from '../tokens/token-keys';
import {
  DIMENSION_MECHANICS,
  DIMENSION_RULES,
  dimensionRulesSchema,
} from './dimension-rules.content';
import { LOOT_TABLES, SKELETON_KING_TABLE_ID } from './loot-tables.content';
import { TOKEN_UNIQUES } from './token-uniques.content';
import { ALIEN_UNIQUE_CHANCE_BP } from './unique-rules.content';

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/src/locales',
);
const textsOf = (lang: string, file: string) =>
  flattenTextTree(JSON.parse(readFileSync(path.join(LOCALES_DIR, lang, file), 'utf-8')));
const LOCALES = ['en', 'uk'].map((lang) => ({
  lang,
  content: textsOf(lang, 'content.json'),
  ui: textsOf(lang, 'ui.json'),
}));

const C15_MECHANICS = [
  'drop-world',
  'matrix-card',
  'unique-roll',
  'alien-roll',
  'buy-back',
  'hero-origin',
] as const;

const DIMENSION_NAMES = Object.values(EDimension).map((key) => [key, `dimensions.${key}`] as const);
const fourDigits = (chance: number) => String(chance).padStart(4, '0');

describe('DA7 C15: every Dimension mechanic has a physical-table rule', () => {
  it('lists exactly the mechanics of C15', () => {
    expect([...DIMENSION_MECHANICS]).toEqual([...C15_MECHANICS]);
    expect(Object.keys(DIMENSION_RULES)).toEqual([...C15_MECHANICS]);
  });

  it.each(C15_MECHANICS)('%s has a tableRule with a text in en and uk', (id) => {
    expect(DIMENSION_RULES[id]).toEqual({ id, tableRule: `content.dimension.${id}.tableRule` });
    for (const { lang, content } of LOCALES)
      expect(content[DIMENSION_RULES[id].tableRule]?.trim().length, lang).toBeGreaterThan(10);
  });

  it.each(C15_MECHANICS)('content without the rule of %s does not parse', (id) => {
    const rules: Record<string, unknown> = { ...DIMENSION_RULES };
    delete rules[id];
    expect(dimensionRulesSchema.safeParse(rules).success).toBe(false);
    expect(dimensionRulesSchema.safeParse({ ...rules, [id]: { id } }).success).toBe(false);
  });
});

describe('DA7 C15: the rule texts agree with content', () => {
  const ruleOf = (content: Record<string, string>, id: (typeof C15_MECHANICS)[number]) =>
    content[DIMENSION_RULES[id].tableRule];

  it.each(LOCALES)('$lang matrix card names every dimension, token type and tier', (locale) => {
    const rows = ruleOf(locale.content, 'matrix-card').split('. ');
    const uniqueWord = { en: 'unique', uk: 'унікальний' }[locale.lang]!;
    const baseWord = { en: 'base', uk: 'звичайний' }[locale.lang]!;
    for (const [dimension, nameKey] of DIMENSION_NAMES) {
      const row = rows.find((text) => text.startsWith(locale.ui[nameKey]));
      const tiers = DIMENSION_TIERS.filter((view) => view.dimension === dimension);
      expect(row, dimension).toContain(
        locale.content[`content.tokens.tokenType.${tiers[0].tokenType}`],
      );
      expect(row!.includes(baseWord)).toBe(tiers.some(({ tier }) => tier === 'base'));
      expect(row!.includes(uniqueWord)).toBe(tiers.some(({ tier }) => tier === 'unique'));
    }
  });

  it('en matrix card pairs every tier with its light', () => {
    const rows = ruleOf(LOCALES[0].content, 'matrix-card').split('. ');
    for (const { dimension, tier, light } of DIMENSION_TIERS) {
      const row = rows.find((text) => text.startsWith(LOCALES[0].ui[`dimensions.${dimension}`]));
      expect(row).toContain(`${tier} ${light.id}`);
    }
  });

  it('uk matrix card pairs every tier with its light', () => {
    const names = {
      blue: 'синє',
      violet: 'фіолетове',
      gray: 'сіре',
      green: 'зелене',
      yellow: 'жовте',
      orange: 'помаранчеве',
      red: 'червоне',
    };
    const rows = ruleOf(LOCALES[1].content, 'matrix-card').split('. ');
    for (const { dimension, tier, light } of DIMENSION_TIERS) {
      const row = rows.find((text) => text.startsWith(LOCALES[1].ui[`dimensions.${dimension}`]));
      const tierName = tier === 'base' ? 'звичайний' : 'унікальний';
      expect(row).toContain(`${tierName} — ${names[light.id]}`);
    }
  });

  it.each(LOCALES)('$lang rolls print the chances of the loot tables as four digits', (locale) => {
    const unique = ruleOf(locale.content, 'unique-roll');
    const alien = ruleOf(locale.content, 'alien-roll');
    expect(unique).toContain('0000');
    expect(unique).toContain(String(BASIS_POINTS - 1));
    expect(unique).toContain(fourDigits(ALIEN_UNIQUE_CHANCE_BP));
    expect(alien).toContain(fourDigits(ALIEN_UNIQUE_CHANCE_BP));
    for (const { uniqueKey, chanceBp } of LOOT_TABLES[SKELETON_KING_TABLE_ID].uniqueDrops ?? []) {
      const name = TOKEN_UNIQUES.find(({ key }) => key === uniqueKey)!.name.nameKey;
      expect(unique).toContain(`${locale.content[name]} ${fourDigits(chanceBp)}`);
    }
  });
});
