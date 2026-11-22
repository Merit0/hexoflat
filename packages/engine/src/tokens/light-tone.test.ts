import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { LIGHT_TONES, lightTone } from './light-tone';
import { BASE_REALMS, TOKEN_ORIGINS } from './token-keys';

describe('lightTone', () => {
  it.each([
    ['base', ERarityKind.GLOOM, 'gloom-base'],
    ['unique', ERarityKind.GLOOM, 'gloom-unique'],
    ['base', ERarityKind.IDOL, 'idol-base'],
    ['unique', ERarityKind.IDOL, 'idol-unique'],
    ['base', ERarityKind.SPARK, 'spark-base'],
    ['unique', ERarityKind.SPARK, 'spark-unique'],
    ['unique', ERarityKind.ALIEN, 'alien-unique'],
  ] as const)('%s %s gives %s', (origin, rarity, tone) => {
    expect(lightTone(origin, rarity)).toBe(tone);
  });

  it('gives exactly the 7 tones of the plan', () => {
    const tones = BASE_REALMS.flatMap((realm) =>
      TOKEN_ORIGINS.map((origin) => lightTone(origin, realm)),
    );
    tones.push(lightTone('unique', ERarityKind.ALIEN));
    expect(new Set(tones)).toEqual(new Set(LIGHT_TONES));
    expect(LIGHT_TONES).toHaveLength(7);
  });

  it('refuses a base alien token', () => {
    expect(() => lightTone('base', ERarityKind.ALIEN)).toThrow(/unique only/);
  });
});
