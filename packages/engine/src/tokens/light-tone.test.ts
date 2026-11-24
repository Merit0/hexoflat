import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { LIGHT_TONES, lightTone } from './light-tone';
import { TOKEN_TIERS } from '../dimensions/dimensions';
import { BASE_TOKEN_TYPES } from './token-keys';

describe('lightTone', () => {
  it.each([
    ['base', ETokenType.GLOOM, 'gloom-base'],
    ['unique', ETokenType.GLOOM, 'gloom-unique'],
    ['base', ETokenType.IDOL, 'idol-base'],
    ['unique', ETokenType.IDOL, 'idol-unique'],
    ['base', ETokenType.SPARK, 'spark-base'],
    ['unique', ETokenType.SPARK, 'spark-unique'],
    ['unique', ETokenType.ALIEN, 'alien-unique'],
  ] as const)('%s %s gives %s', (tier, tokenType, tone) => {
    expect(lightTone(tier, tokenType)).toBe(tone);
  });

  it('gives exactly the 7 tones of the plan', () => {
    const tones = BASE_TOKEN_TYPES.flatMap((tokenType) =>
      TOKEN_TIERS.map((tier) => lightTone(tier, tokenType)),
    );
    tones.push(lightTone('unique', ETokenType.ALIEN));
    expect(new Set(tones)).toEqual(new Set(LIGHT_TONES));
    expect(LIGHT_TONES).toHaveLength(7);
  });

  it('refuses a base alien token', () => {
    expect(() => lightTone('base', ETokenType.ALIEN)).toThrow(/unique only/);
  });
});
