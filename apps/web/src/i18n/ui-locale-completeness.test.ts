import { describe, expect, it } from 'vitest';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import { collectUiTemplateKeys, getByPath } from './locale-keys';

describe('ui locale completeness', () => {
  const keys = collectUiTemplateKeys();

  it('finds the keys used by settings-overlay.vue', () => {
    expect(keys).toEqual(
      expect.arrayContaining([
        'settings.title',
        'settings.close',
        'settings.showHeroMoveTrail',
        'settings.showEnemyVisionArea',
        'settings.language',
      ]),
    );
  });

  it.each(keys)('"%s" has a translation in both en and uk ui.json', (key) => {
    expect(getByPath(enUi, key), `missing in en/ui.json: ${key}`).toEqual(expect.any(String));
    expect(getByPath(ukUi, key), `missing in uk/ui.json: ${key}`).toEqual(expect.any(String));
  });
});
