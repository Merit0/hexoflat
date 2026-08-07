import { describe, expect, it } from 'vitest';
import IntlMessageFormat from 'intl-messageformat';

// Direct test against the ICU formatter itself (not through vue-i18n/the UI)
// — this is what makes the custom message compiler in i18n/index.ts worth
// having: vue-i18n's own default pluralizer only knows singular/plural and
// can't express uk's 4 CLDR categories at all. Boundaries per
// Intl.PluralRules('uk'): 1/21 -> one, 2/4/22/24 -> few, 5 -> many.
const GOBLIN_MESSAGE =
  '{count, plural, one {# гоблін} few {# гобліни} many {# гоблінів} other {# гоблінів}}';

describe('Ukrainian ICU pluralization boundaries', () => {
  it.each([
    [1, '1 гоблін'],
    [2, '2 гобліни'],
    [4, '4 гобліни'],
    [5, '5 гоблінів'],
    [21, '21 гоблін'],
    [22, '22 гобліни'],
    [24, '24 гобліни'],
  ])('formats %i as "%s"', (count, expected) => {
    const formatter = new IntlMessageFormat(GOBLIN_MESSAGE, 'uk');
    expect(formatter.format({ count })).toBe(expected);
  });
});
