import {
  flattenTextTree,
  formatTokenDescription,
  formatTokenName,
  type TokenDictionary,
} from '@hexoflat/engine/tokens/factory/format-token';
import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { i18n } from '@/i18n';

const FALLBACK_LOCALE = 'en';
const dictionaries = new Map<string, TokenDictionary>();

function messagesOf(locale: string): Record<string, string> {
  return flattenTextTree(i18n.global.getLocaleMessage(locale));
}

export function tokenDictionary(locale: string): TokenDictionary {
  const cached = dictionaries.get(locale);
  if (cached) return cached;
  const dictionary = { ...messagesOf(FALLBACK_LOCALE), ...messagesOf(locale) };
  dictionaries.set(locale, dictionary);
  return dictionary;
}

export function currentTokenLocale(): string {
  return i18n.global.locale.value;
}

export function tokenName(token: ItemToken, locale = currentTokenLocale()): string {
  return formatTokenName(token.name, tokenDictionary(locale));
}

export function tokenDescription(token: ItemToken, locale = currentTokenLocale()): string[] {
  return formatTokenDescription(token.description, tokenDictionary(locale));
}

export function itemTitle(
  item: { key: THexobjectKey; token?: ItemToken | null },
  locale = currentTokenLocale(),
): string {
  if (item.token) return tokenName(item.token, locale);
  const title = getMeta(item.key).title;
  return i18n.global.te(title) ? i18n.global.t(title) : title;
}
