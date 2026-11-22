import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { lightFrameFile, lightTone } from './light-tone';

describe('light colour of a token', () => {
  it.each([
    ['base', ERarityKind.GLOOM, 'blue-light.png'],
    ['base', ERarityKind.IDOL, 'gray-light.png'],
    ['base', ERarityKind.SPARK, 'yellow-light.png'],
    ['unique', ERarityKind.GLOOM, 'violet-light.png'],
    ['unique', ERarityKind.IDOL, 'green-light.png'],
    ['unique', ERarityKind.SPARK, 'orange-light.png'],
    ['unique', ERarityKind.ALIEN, 'red-light.png'],
  ] as const)('%s %s shines with %s', (origin, rarity, file) => {
    expect(lightFrameFile(lightTone(origin, rarity))).toBe(file);
  });
});
