import { describe, expect, it } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { isStructurallySame } from '@formatjs/icu-messageformat-parser/manipulator.js';
import enUi from '@/locales/en/ui.json';
import { toPseudoLocale, toPseudoMessage } from './pseudo-locale';

describe('toPseudoMessage', () => {
  it('expands plain text and makes it visually distinct', () => {
    const result = toPseudoMessage('Settings');

    expect(result).not.toBe('Settings');
    expect(result.length).toBeGreaterThan('Settings'.length);
    expect(result).toMatch(/^\[.*~+\]$/);
  });

  it('preserves a simple placeholder verbatim', () => {
    const original = 'Hello {name}, welcome back';
    const result = toPseudoMessage(original);

    expect(result).toContain('{name}');
    expect(isStructurallySame(parse(original), parse(result)).success).toBe(true);
  });

  it('preserves plural placeholder structure (argument name, categories, and the # token)', () => {
    const original =
      '{count, plural, one {# гоблін} few {# гобліни} many {# гоблінів} other {# гоблінів}}';
    const result = toPseudoMessage(original);

    const comparison = isStructurallySame(parse(original), parse(result));
    expect(comparison.success, comparison.error?.message).toBe(true);
    // the literal text inside each plural branch should still be pseudoized
    expect(result).not.toBe(original);
  });

  it('leaves a pure-whitespace literal between two placeholders untouched', () => {
    const original = '{a} {b}';
    const result = toPseudoMessage(original);

    // the lone space between "{a}" and "{b}" must survive as a real space,
    // not get wrapped/padded into e.g. "[ ~]"
    expect(result).toBe('{a} {b}');
  });

  it('round-trips through the ICU parser without throwing', () => {
    const original = '{count, plural, one {# item} other {# items}}';
    expect(() => parse(toPseudoMessage(original))).not.toThrow();
  });
});

describe('toPseudoLocale', () => {
  it('recursively pseudoizes every string leaf of a resource tree, preserving shape', () => {
    const pseudo = toPseudoLocale(enUi);

    expect(pseudo.settings.title).not.toBe(enUi.settings.title);
    expect(typeof pseudo.settings.title).toBe('string');
    expect(Object.keys(pseudo)).toEqual(Object.keys(enUi));
    expect(Object.keys(pseudo.settings)).toEqual(Object.keys(enUi.settings));
  });
});
