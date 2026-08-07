import {
  isLiteralElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js';

const ACCENT_MAP: Record<string, string> = {
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ó',
  u: 'ú',
  c: 'ç',
  n: 'ñ',
  s: 'š',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  E: 'É',
  I: 'Í',
  O: 'Ó',
  U: 'Ú',
  C: 'Ç',
  N: 'Ñ',
  S: 'Š',
  Y: 'Ý',
  Z: 'Ž',
};

// Accents vowels/common consonants (visually distinct from plain ASCII —
// unaccented text stands out immediately as "someone forgot to wrap this in
// t()") and pads length by ~30% (Ukrainian translations tend to run 15-30%
// longer than English — this catches layout overflow before uk copy exists).
// Pure-whitespace literals (the gaps between "text " and "{arg}") are left
// untouched so spacing/structure isn't corrupted.
function pseudoizeText(text: string): string {
  if (!text.trim()) return text;

  const accented = [...text].map((ch) => ACCENT_MAP[ch] ?? ch).join('');
  const padding = '~'.repeat(Math.max(1, Math.ceil(text.length * 0.3)));
  return `[${accented}${padding}]`;
}

function pseudoizeAst(ast: MessageFormatElement[]): MessageFormatElement[] {
  return ast.map((el): MessageFormatElement => {
    if (isLiteralElement(el)) {
      return { ...el, value: pseudoizeText(el.value) };
    }
    if (isSelectElement(el) || isPluralElement(el)) {
      const options = Object.fromEntries(
        Object.entries(el.options).map(([key, option]) => [
          key,
          { ...option, value: pseudoizeAst(option.value) },
        ]),
      );
      return { ...el, options };
    }
    if (isTagElement(el)) {
      return { ...el, children: pseudoizeAst(el.children) };
    }
    return el;
  });
}

// ICU placeholders ({name}, {count, plural, ...}, tags, etc.) are parsed and
// only literal text nodes are rewritten, so interpolation/pluralization
// structure survives untouched — verified in pseudo-locale.test.ts via
// isStructurallySame() against the original message.
export function toPseudoMessage(message: string): string {
  return printAST(pseudoizeAst(parse(message)));
}

type LocaleTree = string | LocaleTree[] | { [key: string]: LocaleTree };

function pseudoizeTree(node: LocaleTree): LocaleTree {
  if (typeof node === 'string') return toPseudoMessage(node);
  if (Array.isArray(node)) return node.map(pseudoizeTree);
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, pseudoizeTree(value)]),
  );
}

// Recursively pseudoizes every string leaf of a locale resource tree (same
// shape as ui.json/content.json). Generated at dev/test time from the real
// en resources — never hand-maintained like a real translation.
export function toPseudoLocale<T extends LocaleTree>(messages: T): T {
  return pseudoizeTree(messages) as T;
}
