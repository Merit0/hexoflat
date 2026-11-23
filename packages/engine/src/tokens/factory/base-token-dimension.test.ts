import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../../content/item-types.content';
import { EDimension, itemFamilyOfDimension } from '../../dimensions/dimensions';
import { MAP_TIERS } from '../token-keys';
import { currentItemTokenSchema, itemTokenSchema } from '../token-schema';
import { createTokenFactory } from './create-token-factory';
import type { GenerationContext } from './token-generation';

const factory = createTokenFactory();
const BASE_DIMENSIONS = [EDimension.HEAVEN, EDimension.EARTH, EDimension.UNDERWORLD] as const;
const TYPES: readonly (string | undefined)[] = [...ITEM_TYPES.map((type) => type.key), undefined];
const ITERATIONS = 500;

function context(index: number, dimension: EDimension): GenerationContext {
  return {
    seed: `da2-c4-seed-${index}`,
    sourceId: 'test:da2.c4',
    n: index,
    realm: itemFamilyOfDimension(dimension),
    mapTier: MAP_TIERS[index % MAP_TIERS.length],
    type: TYPES[Math.floor(index / BASE_DIMENSIONS.length) % TYPES.length],
  };
}

describe('DA2 C2: a generated base token carries origin, dimension and rarity', () => {
  it.each(BASE_DIMENSIONS)('C2: %s base token has the matching fields', (dimension) => {
    const made = factory.createBase(context(7, dimension));
    if (!made.ok) throw new Error(made.refusal.code);
    expect(made.value.origin).toBe('base');
    expect(made.value.dimension).toBe(dimension);
    expect(made.value.rarity).toBe(itemFamilyOfDimension(dimension));
    expect(made.value.baseKey).toBe(`${dimension}-${made.value.type}`);
  });

  it('C4: a base token of the Alien realm is refused with ALIEN_NOT_BASE', () => {
    const made = factory.createBase({ ...context(1, EDimension.EARTH), realm: ERarityKind.ALIEN });
    expect(made).toMatchObject({ ok: false, refusal: { code: 'ALIEN_NOT_BASE' } });
  });
});

describe('DA2 C4 invariant: the base generator never makes an Alien token', () => {
  it(`C4: ${ITERATIONS} base tokens over all base dimensions and types pass the token schema`, () => {
    const seen = new Set<string>();
    for (let index = 0; index < ITERATIONS; index++) {
      const dimension = BASE_DIMENSIONS[index % BASE_DIMENSIONS.length];
      const made = factory.createBase(context(index, dimension));
      if (!made.ok) throw new Error(`${index}: ${made.refusal.code}`);
      const token = made.value;
      expect(currentItemTokenSchema.safeParse(token).success, `${index}`).toBe(true);
      expect(itemTokenSchema.parse(token)).toEqual(token);
      expect(token.origin).toBe('base');
      expect(token.rarity).not.toBe(ERarityKind.ALIEN);
      expect(token.dimension).not.toBe(EDimension.NOWHERE);
      expect(token.dimension).toBe(dimension);
      seen.add(`${token.dimension}:${token.type}`);
    }
    expect(seen.size).toBe(BASE_DIMENSIONS.length * ITEM_TYPES.length);
  });
});
