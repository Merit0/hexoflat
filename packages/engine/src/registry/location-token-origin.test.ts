import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { locationTokenOrigin } from './location-token-origin';

// Characterization: dimension wiring must preserve existing acquisition origins.
describe('registered location token origins', () => {
  it.each([
    ['camping', ERarityKind.IDOL],
    ['silesia', ERarityKind.IDOL],
    ['silesia-north', ERarityKind.IDOL],
    ['cave', ERarityKind.GLOOM],
  ] as const)('%s retains its existing family and default tier', (key, realm) => {
    expect(locationTokenOrigin(key)).toEqual({ realm, mapTier: 1 });
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
    expect(locationTokenOrigin('cave', descriptor)).toEqual({
      realm: ERarityKind.GLOOM,
      mapTier: 4,
    });
    expect(locationTokenOrigin('silesia', descriptor)).toEqual({
      realm: ERarityKind.IDOL,
      mapTier: 4,
    });
  });
});
