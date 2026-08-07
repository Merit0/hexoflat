import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { i18n } from './index';

const TEST_KEY = '__fallbackRegressionTest';

// fallbackLocale: 'en' is set in index.ts's createI18n() call but nothing
// exercised it — this is the regression test that does, against the real
// exported i18n instance rather than a reconstructed one.
describe('fallbackLocale regression', () => {
  const originalLocale = i18n.global.locale.value;

  beforeEach(() => {
    i18n.global.mergeLocaleMessage('en', { [TEST_KEY]: 'Fallback value' });
  });

  afterEach(() => {
    i18n.global.locale.value = originalLocale;
  });

  it('falls back to the en value when a key is missing from uk', () => {
    i18n.global.locale.value = 'uk';

    expect(i18n.global.t(TEST_KEY)).toBe('Fallback value');
  });

  it('resolves from uk directly (no fallback) once uk actually has the key', () => {
    i18n.global.mergeLocaleMessage('uk', { [TEST_KEY]: 'Резервне значення' });
    i18n.global.locale.value = 'uk';

    expect(i18n.global.t(TEST_KEY)).toBe('Резервне значення');
  });

  it('a key missing from every locale does not crash and does not silently invent text', () => {
    const missingKey = '__genuinelyMissingKey';
    i18n.global.locale.value = 'uk';

    expect(() => i18n.global.t(missingKey)).not.toThrow();
    expect(i18n.global.t(missingKey)).toBe(missingKey);
  });
});
