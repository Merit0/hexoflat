import { TOKEN_NAME_RULES, TOKEN_NAME_TEMPLATE_KEYS } from '../../content/token-words.content';
import type { TokenContent } from '../../content/token-content';
import type { TokenDictionary } from './format-token';

export interface TokenNameRules {
  maxWords: number;
  maxWordLetters: number;
  shortWordLetters: number;
  minShortWordShare: number;
}

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function letterCount(word: string): number {
  return word.match(/\p{L}/gu)?.length ?? 0;
}

function wordFailure(key: string, text: string | undefined, rules: TokenNameRules): string | null {
  if (typeof text !== 'string' || text.trim() === '') return `${key}: no text`;
  const words = wordsOf(text);
  if (words.length !== 1) return `${key}: "${text}" must be one word`;
  if (letterCount(text) > rules.maxWordLetters)
    return `${key}: "${text}" has more than ${rules.maxWordLetters} letters`;
  return null;
}

function templateFailure(
  key: string,
  template: string | undefined,
  rules: TokenNameRules,
): string | null {
  if (typeof template !== 'string') return `${key}: no text`;
  const filled = template.replace(/\{\w+\}/g, 'word');
  if (wordsOf(filled).length > rules.maxWords)
    return `${key}: "${template}" gives more than ${rules.maxWords} words`;
  return null;
}

function shortShareFailure(
  texts: readonly (string | undefined)[],
  rules: TokenNameRules,
): string | null {
  if (texts.length === 0) return null;
  const short = texts.filter(
    (text) => typeof text === 'string' && letterCount(text) <= rules.shortWordLetters,
  ).length;
  const share = short / texts.length;
  if (share >= rules.minShortWordShare) return null;
  return `only ${Math.round(share * 100)}% of words have ${rules.shortWordLetters} letters or fewer, needs ${Math.round(rules.minShortWordShare * 100)}%`;
}

export function tokenNameRuleFailures(
  content: Pick<TokenContent, 'types' | 'words'>,
  dictionary: TokenDictionary,
  rules: TokenNameRules = TOKEN_NAME_RULES,
): string[] {
  const wordKeys = [
    ...content.words.prefixes.map((word) => word.key),
    ...content.words.suffixes.map((word) => word.key),
  ];
  const keys = [...content.types.map((type) => type.nounKey), ...wordKeys];
  return [
    ...Object.values(TOKEN_NAME_TEMPLATE_KEYS).map((key) =>
      templateFailure(key, dictionary[key], rules),
    ),
    ...keys.map((key) => wordFailure(key, dictionary[key], rules)),
    shortShareFailure(
      wordKeys.map((key) => dictionary[key]),
      rules,
    ),
  ].filter((failure): failure is string => failure !== null);
}
