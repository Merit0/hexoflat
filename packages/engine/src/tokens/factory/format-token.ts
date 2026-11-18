import { TOKEN_NAME_TEMPLATE_KEYS } from '../../content/token-words.content';
import { i18nKeySchema, wordKeyOf } from '../token-keys';
import type { DescriptionLine, TokenName } from '../token-schema';

export type TokenDictionary = Readonly<Record<string, string>>;

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
