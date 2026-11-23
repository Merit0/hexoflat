import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { executePlayerCommand, type PlayerAggregates } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import { TRADERS } from '../content/traders.content';
import { EDimension } from '../dimensions/dimensions';
import { emptyInventoryState } from '../inventory/inventory-state';
import { sellPriceOf } from '../trade/price-of';
import { HERO } from '../trade/trade-test-setup';
import { deriveStream } from '../utils/random-seeded';
import { gameTokenFactory } from './game-tokens';
import type { ItemToken } from './token-schema';
import { resolveUniqueDrop, type UniqueDropRule } from './unique-drop';
import type { UniqueGenerationContext } from './factory/token-generation';

const ALIEN_RULE: UniqueDropRule[] = [{ uniqueKey: 'last-verdict', chance: '1/1' }];
const SEEDS = ['da2-b1-a', 'da2-b1-b', 'da2-b1-c'];

function uniqueContext(n: number, ownedUniques: string[] = []): UniqueGenerationContext {
  return { seed: 'da2-unique-seed', sourceId: 'test:da2.unique', n, mapTier: 2, ownedUniques };
}

function lastVerdict(n = 0): ItemToken {
  const made = gameTokenFactory().createUnique('last-verdict', uniqueContext(n));
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('DA2 B1: an Alien unique in a location scope', () => {
  it.each([EDimension.EARTH, EDimension.UNDERWORLD])(
    'CURRENT (B1): a 1/1 Alien rule scoped to %s drops nothing',
    (dimension) => {
      for (const seed of SEEDS) {
        const rng = deriveStream(seed, 'test:da2:b1');
        expect(resolveUniqueDrop(ALIEN_RULE, [], rng, { dimension })).toBeNull();
      }
    },
  );

  it('B1: without a scope the same rule drops the Alien unique and mints an Alien token', () => {
    for (const seed of SEEDS) {
      const rng = deriveStream(seed, 'test:da2:b1');
      expect(resolveUniqueDrop(ALIEN_RULE, [], rng)).toBe('last-verdict');
    }
    const token = lastVerdict();
    expect(token).toMatchObject({
      origin: 'unique',
      uniqueKey: 'last-verdict',
      rarity: ERarityKind.ALIEN,
      dimension: EDimension.NOWHERE,
    });
  });
});

describe('DA2 B2: unique duplicates', () => {
  it('CURRENT (B2): a second createUnique of an owned key is refused with UNIQUE_ALREADY_OWNED', () => {
    const factory = gameTokenFactory();
    expect(factory.createUnique('last-verdict', uniqueContext(0)).ok).toBe(true);
    expect(factory.createUnique('last-verdict', uniqueContext(1, ['last-verdict']))).toMatchObject({
      ok: false,
      refusal: { code: 'UNIQUE_ALREADY_OWNED' },
    });
  });

  it('CURRENT (B2): without the key in the owned set a second instance is made', () => {
    const first = lastVerdict(0);
    const second = lastVerdict(1);
    expect(second.id).not.toBe(first.id);
    expect(second.uniqueKey).toBe(first.uniqueKey);
  });

  it('CURRENT (B2): progress.ownedUniques stays empty after createUnique and after a sale', () => {
    const token = lastVerdict();
    const inventory = emptyInventoryState(HERO);
    inventory.bag[0] = {
      id: `${HERO}:0`,
      key: token.type as never,
      type: 'equipment' as never,
      amount: 1,
      token,
    };
    inventory.idSeq = 1;
    const aggregates: PlayerAggregates = { inventory, progress: emptyProgressState(HERO) };
    expect(aggregates.progress.ownedUniques).toEqual([]);

    const outcome = executePlayerCommand(
      aggregates,
      PLAYER_COMMAND_SCHEMAS.SHOP_SELL.parse({
        type: 'SHOP_SELL',
        payload: {
          heroId: HERO,
          revision: inventory.revision,
          trader: 'ilva',
          from: { container: 'bag', index: 0 },
          expectedPrice: sellPriceOf(TRADERS.ilva, { key: token.type as never, token }),
        },
      }),
      {
        devGrantAllowed: false,
        inventory: { stashOpen: false, battleOpen: false },
        trade: { atTrader: 'ilva', rngSeed: 'da2-trader-seed' },
      },
    );
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.events.map((event) => event.type)).toContain('ITEM_SOLD');
    expect((outcome.changed.progress ?? aggregates.progress).ownedUniques).toEqual([]);
  });
});
