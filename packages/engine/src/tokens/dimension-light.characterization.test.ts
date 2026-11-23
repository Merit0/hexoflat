import { describe, expect, it } from 'vitest';
import { EDimension, itemFamilyOfDimension } from '../dimensions/dimensions';
import { LIGHT_COLOR_BY_TONE, LIGHT_TONES, lightFrameFile, lightTone } from './light-tone';
import { TOKEN_ORIGINS } from './token-keys';

const EXPECTED = [
  [EDimension.UNDERWORLD, 'base', 'gloom-base', 'blue'],
  [EDimension.UNDERWORLD, 'unique', 'gloom-unique', 'violet'],
  [EDimension.EARTH, 'base', 'idol-base', 'gray'],
  [EDimension.EARTH, 'unique', 'idol-unique', 'green'],
  [EDimension.HEAVEN, 'base', 'spark-base', 'yellow'],
  [EDimension.HEAVEN, 'unique', 'spark-unique', 'orange'],
  [EDimension.NOWHERE, 'unique', 'alien-unique', 'red'],
] as const;

describe('DA2 C3: light of every dimension x tier', () => {
  it.each(EXPECTED)('C3: %s %s shines %s (%s)', (dimension, tier, tone, color) => {
    const result = lightTone(tier, itemFamilyOfDimension(dimension));
    expect(result).toBe(tone);
    expect(LIGHT_COLOR_BY_TONE[result]).toBe(color);
    expect(lightFrameFile(result)).toBe(`${color}-light.png`);
  });

  it('C3/D1: Idol BASE light stays gray', () => {
    expect(LIGHT_COLOR_BY_TONE[lightTone('base', itemFamilyOfDimension(EDimension.EARTH))]).toBe(
      'gray',
    );
  });

  it('C3: every dimension x tier pair gives a tone, except Nowhere BASE which is refused', () => {
    const tones = Object.values(EDimension).flatMap((dimension) =>
      TOKEN_ORIGINS.flatMap((tier) => {
        if (dimension === EDimension.NOWHERE && tier === 'base') {
          expect(() => lightTone(tier, itemFamilyOfDimension(dimension))).toThrow(/unique only/);
          return [];
        }
        return [lightTone(tier, itemFamilyOfDimension(dimension))];
      }),
    );
    expect([...tones].sort()).toEqual(EXPECTED.map(([, , tone]) => tone).sort());
    expect(new Set(tones)).toEqual(new Set(LIGHT_TONES));
  });
});
