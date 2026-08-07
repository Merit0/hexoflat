import { describe, expect, it } from 'vitest';
import enContent from '@/locales/en/content.json';
import ukContent from '@/locales/uk/content.json';
import { collectContentLocaleKeys, getByPath } from './locale-keys';

describe('content locale completeness', () => {
  const keys = collectContentLocaleKeys();

  it('finds the migrated creature content keys', () => {
    expect(keys).toEqual(
      expect.arrayContaining([
        'content.skeletor.title',
        'content.skeletor.subtitle',
        'content.skeletor.description',
        'content.emitter.title',
        'content.emitter.subtitle',
        'content.emitter.description',
        'content.inferno.title',
        'content.inferno.subtitle',
        'content.inferno.description',
      ]),
    );
  });

  it.each(keys)('"%s" has a translation in both en and uk content.json', (key) => {
    expect(getByPath(enContent, key), `missing in en/content.json: ${key}`).toEqual(
      expect.any(String),
    );
    expect(getByPath(ukContent, key), `missing in uk/content.json: ${key}`).toEqual(
      expect.any(String),
    );
  });
});
