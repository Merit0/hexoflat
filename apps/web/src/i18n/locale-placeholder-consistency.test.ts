import { describe, expect, it } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { isStructurallySame } from '@formatjs/icu-messageformat-parser/manipulator.js';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import enContent from '@/locales/en/content.json';
import ukContent from '@/locales/uk/content.json';
import { flattenLocaleKeys, getByPath } from './locale-keys';

// isStructurallySame() ignores literal text (translations are supposed to
// differ) and only compares ICU argument names + types (plural/select/date/
// number/tag) — exactly what "the same placeholders exist on both sides"
// means. None of our messages use placeholders yet, so this is a dormant
// regression guard for when they do.
function checkPlaceholders(enSource: unknown, ukSource: unknown, label: string) {
  const keys = [
    ...new Set([...flattenLocaleKeys(enSource), ...flattenLocaleKeys(ukSource)]),
  ].sort();

  describe(label, () => {
    it.each(keys)('"%s" has matching ICU placeholders in en and uk', (key) => {
      const enValue = getByPath(enSource, key);
      const ukValue = getByPath(ukSource, key);

      // A key missing on one side entirely is the completeness tests' job
      // to catch, not this one's.
      if (typeof enValue !== 'string' || typeof ukValue !== 'string') return;

      const result = isStructurallySame(parse(enValue), parse(ukValue));
      expect(result.success, result.error?.message).toBe(true);
    });
  });
}

checkPlaceholders(enUi, ukUi, 'ui.json placeholder consistency');
checkPlaceholders(enContent, ukContent, 'content.json placeholder consistency');
