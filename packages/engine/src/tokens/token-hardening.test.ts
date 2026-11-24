import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT } from '../content/token-content';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { TRADERS } from '../content/traders.content';
import { planClaim } from '../quests/quest-log';
import { catalogueWith, counting, inventoryWith, progressWith } from '../quests/quest-test-setup';
import { rollTraderGoods } from '../trade/trader-view';
import { createTokenFactory } from './factory/create-token-factory';
import { tokenSourceIdOf } from './game-tokens';
import { uniqueDropRulesSchema } from './unique-drop';

const CONTEXT = {
  seed: 'audit-secret',
  sourceId: 'test:audit',
  n: 0,
  tokenType: ETokenType.IDOL,
  mapTier: 1 as const,
  type: 'shield',
};

describe('token audit regressions', () => {
  it('assigns distinct ids to every quest reward row', () => {
    const quest = counting('audit', 'TEST', 1, {
      rewards: [
        { kind: 'item', itemKey: 'sword', amount: 1 },
        { kind: 'item', itemKey: 'shield', amount: 1 },
      ],
    });
    const progress = progressWith(50);
    progress.quests.active = [{ questId: 'audit', progress: 1, state: 'ready' }];
    const result = planClaim(progress, inventoryWith([]), 'audit', {
      catalogue: catalogueWith(quest),
      atBoard: true,
      rngSeed: CONTEXT.seed,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.inventory!.bag.flatMap((cell) => (cell?.token ? [cell.token.id] : []));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('does not merge distinct source segments', () => {
    const sources = [
      ['a.b', 'c'],
      ['a', 'b.c'],
      ['A', 'b.c'],
      ['a/b', 'c'],
      ['a-b', 'c'],
    ];
    expect(new Set(sources.map((parts) => tokenSourceIdOf('quest', ...parts))).size).toBe(5);
  });

  it('namespaces independently owned shop goods', () => {
    const ids = ['first-secret', 'second-secret'].flatMap((seed) =>
      rollTraderGoods(TRADERS.ilva, seed, 'ilva', 0).flatMap((good) =>
        good?.token ? [good.token.id] : [],
      ),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['bad', '1/' + '9'.repeat(310), '9007199254740992/9007199254740992'])(
    'refuses malformed/unsafe fraction %s without throwing',
    (chance) => {
      expect(uniqueDropRulesSchema.safeParse([{ uniqueKey: 'a', chance }]).success).toBe(false);
    },
  );

  it('accepts a new source without editing a source enum', () => {
    expect(createTokenFactory().createBase({ ...CONTEXT, sourceId: 'boss:dragon' }).ok).toBe(true);
  });

  it('refuses unknown attributes as a result, not an exception', () => {
    expect(
      createTokenFactory().createBase(CONTEXT, {
        attributes: [{ key: 'unknown', value: 1 }],
      }).ok,
    ).toBe(false);
  });

  it('limits implemented shield attributes by source tier', () => {
    const content = {
      ...TOKEN_CONTENT,
      attributes: TOKEN_CONTENT.attributes.map((attribute) =>
        attribute.key === 'shield' ? { ...attribute, implemented: true } : attribute,
      ),
    };
    const factory = createTokenFactory(content);
    expect(factory.createBase(CONTEXT, { attributes: [] }).ok).toBe(true);
    expect(factory.createBase(CONTEXT, { attributes: [{ key: 'shield', value: 1 }] }).ok).toBe(
      true,
    );
    for (const value of [2, 5, 999]) {
      expect(factory.createBase(CONTEXT, { attributes: [{ key: 'shield', value }] }).ok).toBe(
        false,
      );
    }
    expect(
      factory.createBase(
        { ...CONTEXT, mapTier: 4 },
        {
          attributes: [{ key: 'shield', value: 2 }],
        },
      ).ok,
    ).toBe(true);
  });

  it('checks fixed unique attributes against the attribute itemMax, not the source tier', () => {
    const factory = createTokenFactory();
    expect(
      factory.createUnique('last-verdict', { ...CONTEXT, mapTier: 1, ownedUniques: [] }).ok,
    ).toBe(true);
    expect(() =>
      createTokenFactory(TOKEN_CONTENT, undefined, [
        { ...TOKEN_UNIQUES[0], attributes: [{ key: 'heart', value: 11 }] },
      ]),
    ).toThrow(/above its itemMax 10/);
  });

  it('rejects incompatible unique content at construction', () => {
    expect(() =>
      createTokenFactory(TOKEN_CONTENT, undefined, [
        {
          ...TOKEN_UNIQUES[0],
          attributes: [{ key: 'shield', value: 999 }],
        },
      ]),
    ).toThrow();
  });
});
