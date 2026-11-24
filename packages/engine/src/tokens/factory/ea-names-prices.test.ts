import { describe, expect, it } from 'vitest';
import { TOKEN_CONTENT, type TokenContent } from '../../content/token-content';
import { ITEM_TYPES } from '../../content/item-types.content';
import type { ItemToken } from '../token-schema';
import { createTokenFactory } from './create-token-factory';
import { contextFor, implementedContent } from './factory-test-setup';
import { adjectiveBandFor } from './name-generator';
import { priceBandOf } from './price-generator';

const SEEDS = 500;

function tokensOf(content: TokenContent): ItemToken[] {
  const factory = createTokenFactory(content);
  return ITEM_TYPES.flatMap((type) =>
    Array.from({ length: SEEDS }, (_, index) => {
      const result = factory.createBase(
        contextFor(index + 1, { sourceId: 'test:ea', type: type.key }),
      );
      if (!result.ok) throw new Error(JSON.stringify(result.refusal));
      return result.value;
    }),
  );
}

const CONTENTS: [string, TokenContent][] = [
  ['current content', TOKEN_CONTENT],
  ['content with every attribute implemented', implementedContent()],
];

describe.each(CONTENTS)('EA-6 and EA-7 over %s', (_label, content) => {
  const tokens = tokensOf(content);
  const typeOf = (key: string) => content.types.find((type) => type.key === key)!;
  const adjectiveOf = (key: string) =>
    content.adjectives.find((adjective) => adjective.key === key)!;

  it('EA-6: picks an adjective of the band that equals the attribute count', () => {
    for (const token of tokens) {
      if (token.name.kind !== 'adjective') continue;
      expect(adjectiveOf(token.name.adjective).band).toBe(
        adjectiveBandFor(token.attributes.length),
      );
    }
  });

  it('EA-6: picks an adjective allowed by the material and the group of the type', () => {
    for (const token of tokens) {
      if (token.name.kind !== 'adjective') continue;
      const type = typeOf(token.type);
      const adjective = adjectiveOf(token.name.adjective);
      if (adjective.material) expect(type.materials).toContain(adjective.material);
      if (adjective.groups) expect(adjective.groups).toContain(type.group);
    }
  });

  it('EA-6: names tools by the noun only and every other type by an adjective', () => {
    for (const token of tokens) {
      const type = typeOf(token.type);
      expect(token.name.kind).toBe(type.tool ? 'noun' : 'adjective');
    }
  });

  it('EA-7: keeps the price inside the third of the tokenType range chosen by the attribute count', () => {
    for (const token of tokens) {
      const [low, high] = priceBandOf(
        content.priceRanges[token.tokenType as keyof typeof content.priceRanges],
        token.attributes.length,
      );
      expect(token.price).toBeGreaterThanOrEqual(low);
      expect(token.price).toBeLessThanOrEqual(high);
    }
  });
});

describe('EA-6 band coverage', () => {
  it('reaches every band when every attribute is implemented', () => {
    const bands = new Set(
      tokensOf(implementedContent())
        .filter((token) => token.name.kind === 'adjective')
        .map((token) => adjectiveBandFor(token.attributes.length)),
    );
    expect(bands).toEqual(new Set(['poor', 'plain', 'fine']));
  });
});

describe('EA-7 price thirds', () => {
  it('splits a range into three touching thirds that cover it', () => {
    expect([0, 1, 2].map((count) => priceBandOf([100, 399], count))).toEqual([
      [100, 199],
      [200, 299],
      [300, 399],
    ]);
    expect(priceBandOf([100, 399], 5)).toEqual([300, 399]);
  });
});
