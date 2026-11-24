import { describe, expect, it } from 'vitest';
import { EDimension } from '../dimensions/dimensions';
import { currentItemTokenSchema, itemTokenSchema } from './token-schema';
import { upcastTokenDimension } from './upcast-token-dimension';

function godExecutorSave(): Record<string, unknown> {
  return {
    id: 'upcast:hero-1.bag.r0c0:0',
    origin: 'unique',
    uniqueKey: 'last-verdict',
    type: 'sword',
    rarity: 'god-executor',
    name: { kind: 'authored', nameKey: 'content.tokens.unique.last-verdict.name' },
    description: [
      { key: 'content.tokens.unique.last-verdict.desc', params: {} },
      {
        key: 'content.tokens.line.kind',
        params: { type: 'content.tokens.noun.sword', realm: 'content.tokens.realm.god-executor' },
      },
      { key: 'content.tokens.line.tier', params: { tier: 4 } },
    ],
    attributes: [{ key: 'heart', value: 2 }],
    skills: ['b_strike'],
    price: 2400,
    sprite: 'unique-last-verdict',
    mapTier: 4,
    generatorVersion: 3,
    ext: { aspects: [], heroGrade: null },
  };
}

describe('DA2 C14/D3: an old God Executor save', () => {
  it('CURRENT (C14/D3): upcastTokenDimension maps god-executor to alien/nowhere and keeps the tier', () => {
    const saved = godExecutorSave();
    const before = structuredClone(saved);
    const upcast = upcastTokenDimension(saved) as Record<string, unknown>;

    expect(saved).toEqual(before);
    const kept = { ...saved };
    delete kept.origin;
    delete kept.rarity;
    expect(upcast).toEqual({
      ...kept,
      tier: 'unique',
      tokenType: 'alien',
      dimension: EDimension.NOWHERE,
      description: [
        { key: 'content.tokens.unique.last-verdict.desc', params: {} },
        {
          key: 'content.tokens.line.kind',
          params: {
            type: 'content.tokens.noun.sword',
            tokenType: 'content.tokens.tokenType.alien',
          },
        },
        { key: 'content.tokens.line.tier', params: { tier: 4 } },
      ],
    });
    expect(upcast.tier).toBe('unique');
    expect(upcast).not.toHaveProperty('origin');
    expect(upcast).not.toHaveProperty('rarity');
    expect(upcast).not.toHaveProperty('baseKey');
  });

  it('CURRENT (C14): the persisted reader accepts it and keeps id, price, stats and generatorVersion', () => {
    const loaded = itemTokenSchema.parse(godExecutorSave());
    expect(currentItemTokenSchema.safeParse(loaded).success).toBe(true);
    expect(loaded).toMatchObject({
      id: 'upcast:hero-1.bag.r0c0:0',
      price: 2400,
      attributes: [{ key: 'heart', value: 2 }],
      generatorVersion: 3,
      mapTier: 4,
    });
  });

  it('C2: a god-executor base token is still refused (Alien is unique only)', () => {
    const base = { ...godExecutorSave(), origin: 'base' } as Record<string, unknown>;
    delete base.uniqueKey;
    expect(itemTokenSchema.safeParse(base).success).toBe(false);
  });
});
