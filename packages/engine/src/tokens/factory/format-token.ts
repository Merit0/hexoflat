import { EQUIPMENT_TYPES } from '../../content/item-types.content';
import { TOKEN_ADJECTIVES } from '../../content/token-adjectives.content';
import {
  TOKEN_ADJECTIVE_NAME_TEMPLATE_KEY,
  TOKEN_NAME_TEMPLATE_KEYS,
} from '../../content/token-words.content';
import { attributeRowsOf } from '../attribute-display';
import type { Adjective } from '../equipment/adjective-schema';
import type { EquipmentAttributeDefinition } from '../equipment/equipment-attribute-schema';
import { NOUN_GENDERS, type TNounGender } from '../equipment/equipment-keys';
import { i18nKeySchema, WORD_KEY_ROOT, wordKeyOf } from '../token-keys';
import type { DescriptionLine, ItemToken, TokenName } from '../token-schema';

export type TokenDictionary = Readonly<Record<string, string>>;

export interface TokenAttributeRow {
  key: string;
  label: string;
  icon: string;
  value: string;
}

const DEFAULT_GENDER: TNounGender = 'm';
const UK_LOCALE = 'uk';

export function flattenTextTree(tree: unknown, prefix = ''): Record<string, string> {
  if (typeof tree === 'string') return prefix ? { [prefix]: tree } : {};
  if (tree === null || typeof tree !== 'object') return {};
  return Object.entries(tree as Record<string, unknown>).reduce<Record<string, string>>(
    (flat, [key, value]) => ({
      ...flat,
      ...flattenTextTree(value, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

export function adjectiveTextKey(adjective: string, gender: TNounGender): string {
  return `${WORD_KEY_ROOT}.adjective.${adjective}.${gender}`;
}

export function adjectiveTexts(
  locale: string,
  adjectives: readonly Adjective[] = TOKEN_ADJECTIVES,
): Record<string, string> {
  return Object.fromEntries(
    adjectives.flatMap((adjective) =>
      NOUN_GENDERS.map((gender) => [
        adjectiveTextKey(adjective.key, gender),
        locale === UK_LOCALE ? adjective.uk[gender] : adjective.en,
      ]),
    ),
  );
}

export function withAdjectiveTexts(dictionary: TokenDictionary, locale: string): TokenDictionary {
  return { ...dictionary, ...adjectiveTexts(locale) };
}

function genderOf(noun: string): TNounGender {
  return EQUIPMENT_TYPES.find((type) => type.key === noun)?.gender ?? DEFAULT_GENDER;
}

function textOf(key: string, dictionary: TokenDictionary): string {
  const text = dictionary[key];
  if (typeof text !== 'string' || text.trim() === '')
    throw new Error(`Missing token text "${key}"`);
  return text;
}

function fill(template: string, params: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] ?? placeholder);
}

export function formatTokenName(name: TokenName, dictionary: TokenDictionary): string {
  if (name.kind === 'authored') return textOf(name.nameKey, dictionary);
  const noun = textOf(wordKeyOf('noun', name.noun), dictionary);
  if (name.kind === 'noun') return noun;
  if (name.kind === 'adjective') {
    return fill(textOf(TOKEN_ADJECTIVE_NAME_TEMPLATE_KEY, dictionary), {
      adjective: textOf(adjectiveTextKey(name.adjective, genderOf(name.noun)), dictionary),
      noun,
    });
  }
  const shape = name.prefix && name.suffix ? 'full' : name.prefix ? 'prefix' : 'suffix';
  return fill(textOf(TOKEN_NAME_TEMPLATE_KEYS[shape], dictionary), {
    noun,
    ...(name.prefix ? { prefix: textOf(name.prefix, dictionary) } : {}),
    ...(name.suffix ? { suffix: textOf(name.suffix, dictionary) } : {}),
  });
}

function paramText(value: string | number, dictionary: TokenDictionary): string {
  if (typeof value === 'number') return String(value);
  return i18nKeySchema.safeParse(value).success ? textOf(value, dictionary) : value;
}

export function formatTokenDescription(
  lines: readonly DescriptionLine[],
  dictionary: TokenDictionary,
): string[] {
  return lines.map((line) => {
    const params = Object.fromEntries(
      Object.entries(line.params).map(([name, value]) => [name, paramText(value, dictionary)]),
    );
    return fill(textOf(line.key, dictionary), params);
  });
}

export function formatTokenAttributes(
  token: Pick<ItemToken, 'attributes' | 'description'>,
  dictionary: TokenDictionary,
  attributes?: readonly EquipmentAttributeDefinition[],
): TokenAttributeRow[] {
  return attributeRowsOf(token, attributes).map((row) => ({
    key: row.key,
    label: textOf(row.labelKey, dictionary),
    icon: row.icon,
    value: fill(textOf(row.formatKey, dictionary), { value: String(row.value) }),
  }));
}
