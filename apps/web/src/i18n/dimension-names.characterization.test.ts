import { describe, expect, it } from 'vitest';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import enContent from '@/locales/en/content.json';
import ukContent from '@/locales/uk/content.json';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import { getByPath } from './locale-keys';

const LOCALES = [
  ['en', enUi, enContent],
  ['uk', ukUi, ukContent],
] as const;

const KINDS = Object.values(ETokenType);

function text(tree: unknown, key: string): unknown {
  return getByPath(tree, key);
}

const NAMES = {
  en: { gloom: 'Gloom', idol: 'Idol', spark: 'Spark', alien: 'Alien' },
  uk: { gloom: 'Морок', idol: 'Кумир', spark: 'Іскра', alien: 'Прибулець' },
} as const;

describe('DA3b C11: one key family for token-type names', () => {
  it.each(LOCALES)(
    'C11: %s has content.tokens.tokenType.* for every token type with the old text',
    (locale, _ui, content) => {
      for (const kind of KINDS)
        expect(text(content, `content.tokens.tokenType.${kind}`), kind).toBe(NAMES[locale][kind]);
    },
  );

  it.each(LOCALES)('F5: %s has no second key family for the same names', (_locale, ui, content) => {
    expect(text(ui, 'itemTooltip.rarity')).toBeUndefined();
    expect(text(content, 'content.tokens.realm')).toBeUndefined();
  });
});
