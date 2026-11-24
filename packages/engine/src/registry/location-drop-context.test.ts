import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { locationDropContext } from './location-drop-context';

// Characterization: dimension wiring must preserve existing acquisition origins.
describe('registered location token origins', () => {
  it.each([
    ['camping', ETokenType.IDOL],
    ['silesia', ETokenType.IDOL],
    ['silesia-north', ETokenType.IDOL],
    ['cave', ETokenType.GLOOM],
  ] as const)('%s retains its existing family and default tier', (key, tokenType) => {
    expect(locationDropContext(key)).toEqual({ tokenType, mapTier: 1 });
  });

  it('takes the tier from the source descriptor independently of location', () => {
    const descriptor = {
      kind: 'RECIPE' as const,
      recipeId: 'cave',
      version: 1,
      seed: 'dimension-characterization',
      params: { tier: 4 },
      attempt: 0,
    };
    expect(locationDropContext('cave', descriptor)).toEqual({
      tokenType: ETokenType.GLOOM,
      mapTier: 4,
    });
    expect(locationDropContext('silesia', descriptor)).toEqual({
      tokenType: ETokenType.IDOL,
      mapTier: 4,
    });
  });
});
