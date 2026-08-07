import { describe, expect, it } from 'vitest';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import enContent from '@/locales/en/content.json';
import ukContent from '@/locales/uk/content.json';
import { collectContentLocaleKeys, collectUiTemplateKeys, flattenLocaleKeys } from './locale-keys';

// Reverse of the completeness tests: those check "every key the code/content
// needs exists in the locale files"; this checks the other direction —
// "every key sitting in the locale files is still needed". Catches
// translations left behind after a key gets renamed or a component removed.
describe('locale files have no orphaned keys', () => {
  const contentKeys = new Set(collectContentLocaleKeys());
  const uiKeys = new Set(collectUiTemplateKeys());

  const localeFileKeys = new Set([
    ...flattenLocaleKeys(enContent),
    ...flattenLocaleKeys(ukContent),
  ]);
  const uiFileKeys = new Set([...flattenLocaleKeys(enUi), ...flattenLocaleKeys(ukUi)]);

  it.each([...localeFileKeys].sort())('content.json key "%s" is still referenced', (key) => {
    expect(contentKeys.has(key), `orphaned content.json key: ${key}`).toBe(true);
  });

  it.each([...uiFileKeys].sort())('ui.json key "%s" is still referenced', (key) => {
    expect(uiKeys.has(key), `orphaned ui.json key: ${key}`).toBe(true);
  });
});
