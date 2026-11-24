import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { lightFrameFile, lightTone } from './light-tone';

describe('light colour of a token', () => {
  it.each([
    ['base', ETokenType.GLOOM, 'blue-light.png'],
    ['base', ETokenType.IDOL, 'gray-light.png'],
    ['base', ETokenType.SPARK, 'yellow-light.png'],
    ['unique', ETokenType.GLOOM, 'violet-light.png'],
    ['unique', ETokenType.IDOL, 'green-light.png'],
    ['unique', ETokenType.SPARK, 'orange-light.png'],
    ['unique', ETokenType.ALIEN, 'red-light.png'],
  ] as const)('%s %s shines with %s', (tier, tokenType, file) => {
    expect(lightFrameFile(lightTone(tier, tokenType))).toBe(file);
  });
});
