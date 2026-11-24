import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT } from '../content/token-content';
import { EDimension } from '../dimensions/dimensions';
import { createTokenFactory } from './factory/create-token-factory';
import type { GenerationContext } from './factory/token-generation';
import { lightTone } from './light-tone';
import { itemTokenSchema, type ItemToken } from './token-schema';

const shared = createTokenFactory({
  ...TOKEN_CONTENT,
  baseItems: TOKEN_CONTENT.baseItems.map((item) =>
    item.key === 'earth-sword' ? { ...item, sharedWith: [EDimension.UNDERWORLD] } : item,
  ),
});

function underworldDrop(n: number, extra: Partial<GenerationContext> = {}): ItemToken {
  const made = shared.createBase({
    seed: `da2-b9-${n}`,
    sourceId: 'test:da2.b9',
    n,
    tokenType: ETokenType.GLOOM,
    mapTier: 2,
    type: 'sword',
    ...extra,
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('DA2 B9/D4: an EARTH base shared with UNDERWORLD, dropped in UNDERWORLD', () => {
  it('CURRENT (B9): the token takes the base owner dimension (idol), not the drop dimension', () => {
    const token = underworldDrop(0, { baseKey: 'earth-sword' });
    expect(token).toMatchObject({
      baseKey: 'earth-sword',
      dimension: EDimension.EARTH,
      tokenType: ETokenType.IDOL,
    });
    expect(lightTone(token.tier, token.tokenType)).toBe('idol-base');
    expect(itemTokenSchema.parse(token)).toEqual(token);
  });

  it('CURRENT (B9): a generic UNDERWORLD sword drop that picks the shared base is idol', () => {
    const tokens = Array.from({ length: 40 }, (_, n) => underworldDrop(n));
    const picked = tokens.filter((token) => token.baseKey === 'earth-sword');
    const own = tokens.filter((token) => token.baseKey === 'underworld-sword');
    expect(picked.length).toBeGreaterThan(0);
    expect(own.length).toBeGreaterThan(0);
    for (const token of picked)
      expect(token).toMatchObject({ dimension: 'earth', tokenType: 'idol' });
    for (const token of own)
      expect(token).toMatchObject({ dimension: 'underworld', tokenType: 'gloom' });
  });

  it('B9: the schema refuses a shared-base token recoloured to the drop dimension', () => {
    const token = underworldDrop(0, { baseKey: 'earth-sword' });
    const recoloured = { ...token, dimension: EDimension.UNDERWORLD, tokenType: ETokenType.GLOOM };
    expect(itemTokenSchema.safeParse(recoloured).success).toBe(false);
  });
});
