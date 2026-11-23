import { describe, expect, it } from 'vitest';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import enContent from '@/locales/en/content.json';
import ukContent from '@/locales/uk/content.json';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import { getByPath } from './locale-keys';

const LOCALES = [
  ['en', enUi, enContent],
  ['uk', ukUi, ukContent],
] as const;

const KINDS = Object.values(ERarityKind);

function text(tree: unknown, key: string): unknown {
  return getByPath(tree, key);
}

describe('DA2 C11: token-type names exist in both locales', () => {
  it.each(LOCALES)('C11: %s has itemTooltip.rarity.* for every token type', (_locale, ui) => {
    for (const kind of KINDS) {
      const value = text(ui, `itemTooltip.rarity.${kind}`);
      expect(typeof value, kind).toBe('string');
      expect((value as string).length, kind).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)(
    'C11: %s has content.tokens.realm.* for every token type',
    (_locale, _ui, content) => {
      for (const kind of KINDS) {
        const value = text(content, `content.tokens.realm.${kind}`);
        expect(typeof value, kind).toBe('string');
        expect((value as string).length, kind).toBeGreaterThan(0);
      }
    },
  );

  it.each(LOCALES)(
    'CURRENT (C11/F5): %s keeps the same name in two keys (itemTooltip.rarity and content.tokens.realm)',
    (_locale, ui, content) => {
      for (const kind of KINDS)
        expect(text(ui, `itemTooltip.rarity.${kind}`), kind).toBe(
          text(content, `content.tokens.realm.${kind}`),
        );
    },
  );
});
