import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT } from '../content/token-content';
import { TRADERS } from '../content/traders.content';
import { planClaim } from '../quests/quest-log';
import { catalogueWith, counting, inventoryWith, progressWith } from '../quests/quest-test-setup';
import { rollTraderGoods } from '../trade/trader-view';
import { TypeRegistry } from './registries';
import { tokenSourceIdOf } from './source-id';
import { createTokenFactory } from './factory/create-token-factory';

const origin = { realm: ERarityKind.GLOOM, mapTier: 4 } as const;
const context = {
  ...origin,
  seed: 'secret-0123456789abcdef',
  sourceId: 'boss:dragon',
  n: 0,
  type: 'shield',
};

describe('source tier and injected generation policies', () => {
  it('uses the quest reward source tier even when claimed at the camp board', () => {
    const quest = counting('audit', 'TEST', 1, {
      rewardOrigin: origin,
      rewards: [{ kind: 'item', itemKey: 'shield', amount: 1 }],
    });
    const progress = progressWith(50);
    progress.quests.active = [{ questId: 'audit', progress: 1, state: 'ready' }];
    const result = planClaim(progress, inventoryWith([]), 'audit', {
      atBoard: true,
      catalogue: catalogueWith(quest),
      rngSeed: context.seed,
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.inventory!.bag[0]!.token).toMatchObject({ mapTier: 4, rarity: 'gloom' });
  });

  it('uses the trader content tier rather than the current player location', () => {
    const goods = rollTraderGoods(
      { ...TRADERS.ilva, tokenOrigin: origin },
      context.seed,
      'ilva',
      0,
    );
    const tokens = goods.flatMap((good) => (good?.token ? [good.token] : []));
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(token).toMatchObject({ mapTier: 4, rarity: 'gloom' });
  });

  it('validates the output of injected generators against the source ceiling', () => {
    const factory = createTokenFactory(TOKEN_CONTENT, undefined, undefined, {
      attributeGenerator: { generate: () => [{ key: 'heart', value: 5 }] },
    });
    expect(factory.createBase({ ...context, mapTier: 1 }).ok).toBe(false);
  });

  it('keeps other random streams stable when name generation consumes more randomness', () => {
    const normal = createTokenFactory().createBase(context);
    const changed = createTokenFactory(TOKEN_CONTENT, undefined, undefined, {
      nameGenerator: {
        generate: ({ type }, rng) => {
          for (let n = 0; n < 100; n++) rng();
          return { kind: 'noun', noun: type.key };
        },
      },
    }).createBase(context);
    expect(normal.ok && changed.ok).toBe(true);
    if (normal.ok && changed.ok)
      expect({ ...changed.value, name: normal.value.name }).toEqual(normal.value);
  });

  it('refuses an encoded secret in an id and does not echo invalid secret-bearing input', () => {
    const factory = createTokenFactory();
    const sourceId = tokenSourceIdOf('chest', context.seed + ':private');
    expect(factory.createBase({ ...context, sourceId })).toMatchObject({
      ok: false,
      refusal: { code: 'SOURCE_ID_CONTAINS_SEED' },
    });
    expect(
      JSON.stringify(factory.createBase({ ...context, sourceId: context.seed + ':INVALID' })),
    ).not.toContain(context.seed);
  });

  it('freezes registered content so callers cannot change subsequent rolls', () => {
    const types = new TypeRegistry(TOKEN_CONTENT.types);
    expect(() => {
      types.get('shield').block!.sides = 5;
    }).toThrow();
    expect(types.get('shield').block!.sides).toBe(1);
  });
});
