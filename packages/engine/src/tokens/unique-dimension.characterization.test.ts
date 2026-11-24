import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { executePlayerCommand, type PlayerAggregates } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import { TRADERS } from '../content/traders.content';
import { EDimension } from '../dimensions/dimensions';
import { emptyInventoryState, inventoryStateSchema } from '../inventory/inventory-state';
import { sellPriceOf } from '../trade/price-of';
import { HERO } from '../trade/trade-test-setup';
import { deriveStream } from '../utils/random-seeded';
import { createTokenRegistries } from '../content/token-content';
import { ALIEN_UNIQUE_CHANCE_BP } from '../content/unique-rules.content';
import { BASIS_POINTS } from './token-keys';
import { gameTokenFactory } from './game-tokens';
import type { ItemToken } from './token-schema';
import { resolveUniqueDrop, type UniqueDropRule } from './unique-drop';
import type { UniqueGenerationContext } from './factory/token-generation';

const ALIEN_RULE: UniqueDropRule[] = [{ uniqueKey: 'last-verdict', chanceBp: BASIS_POINTS }];
const NO_ALIEN_RULE: UniqueDropRule[] = [{ uniqueKey: 'last-verdict', chanceBp: 0 }];
const LOCATION_SCOPES = [EDimension.EARTH, EDimension.UNDERWORLD, EDimension.HEAVEN];
const SEEDS = ['da2-b1-a', 'da2-b1-b', 'da2-b1-c'];

function uniqueContext(n: number): UniqueGenerationContext {
  return { seed: 'da2-unique-seed', sourceId: 'test:da2.unique', n, mapTier: 2 };
}

function lastVerdict(n = 0): ItemToken {
  const made = gameTokenFactory().createUnique('last-verdict', uniqueContext(n));
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('DA2 B1: an Alien unique in a location scope', () => {
  it.each(LOCATION_SCOPES)(
    'DA5a-2 B1: a 10000 bp Alien rule scoped to %s drops a minted Alien instance',
    (dimension) => {
      for (const seed of SEEDS) {
        const rng = deriveStream(seed, 'test:da2:b1');
        const key = resolveUniqueDrop(ALIEN_RULE, rng, { dimension });
        expect(key).toBe('last-verdict');
        const made = gameTokenFactory().createUnique(key!, {
          ...uniqueContext(0),
          seed,
          dimension,
        });
        if (!made.ok) throw new Error(made.refusal.code);
        expect(made.value).toMatchObject({
          tier: 'unique',
          uniqueKey: 'last-verdict',
          tokenType: ETokenType.ALIEN,
          dimension: EDimension.NOWHERE,
        });
        expect(made.value.instanceId).toMatch(/^[0-9a-f]{32}$/);
      }
    },
  );

  it.each(LOCATION_SCOPES)(
    'DA5a-2 B1: a 0 bp Alien rule scoped to %s drops nothing',
    (dimension) => {
      for (const seed of SEEDS) {
        const rng = deriveStream(seed, 'test:da2:b1');
        expect(resolveUniqueDrop(NO_ALIEN_RULE, rng, { dimension })).toBeNull();
      }
    },
  );

  it('B1: a unique of another world still stays inside its own scope', () => {
    const gloom: UniqueDropRule[] = [{ uniqueKey: 'lantern-eater', chanceBp: BASIS_POINTS }];
    const drop = (dimension: EDimension) =>
      resolveUniqueDrop(gloom, deriveStream('da5a-b1', 'test:da5a:b1'), { dimension });
    expect(drop(EDimension.UNDERWORLD)).toBe('lantern-eater');
    expect(drop(EDimension.EARTH)).toBeNull();
    expect(
      gameTokenFactory().createUnique('lantern-eater', {
        ...uniqueContext(0),
        dimension: EDimension.EARTH,
      }),
    ).toMatchObject({ ok: false, refusal: { code: 'UNIQUE_NOT_IN_DIMENSION' } });
  });

  it('B1: the unique registry lists the Alien template for every location', () => {
    const { uniques } = createTokenRegistries();
    for (const dimension of LOCATION_SCOPES) {
      expect(uniques.forDimension(dimension).map(({ key }) => key)).toContain('last-verdict');
    }
  });

  it('Q2: the Alien chance is one config value of 50 basis points', () => {
    expect(ALIEN_UNIQUE_CHANCE_BP).toBe(50);
    const rules: UniqueDropRule[] = [
      { uniqueKey: 'last-verdict', chanceBp: ALIEN_UNIQUE_CHANCE_BP },
    ];
    const dropAt = (roll: number) =>
      resolveUniqueDrop(rules, () => roll, { dimension: EDimension.EARTH });
    expect(dropAt(0)).toBe('last-verdict');
    expect(dropAt(0.0049)).toBe('last-verdict');
    expect(dropAt(0.005)).toBeNull();
  });

  it('B1: without a scope the same rule drops the Alien unique and mints an Alien token', () => {
    for (const seed of SEEDS) {
      const rng = deriveStream(seed, 'test:da2:b1');
      expect(resolveUniqueDrop(ALIEN_RULE, rng)).toBe('last-verdict');
    }
    const token = lastVerdict();
    expect(token).toMatchObject({
      tier: 'unique',
      uniqueKey: 'last-verdict',
      tokenType: ETokenType.ALIEN,
      dimension: EDimension.NOWHERE,
    });
  });
});

describe('DA2 B2: unique duplicates', () => {
  it('B2 (Q5): the same template creates two instances with different ids', () => {
    const first = lastVerdict(0);
    const second = lastVerdict(1);
    expect(second.uniqueKey).toBe(first.uniqueKey);
    expect(second.id).not.toBe(first.id);
    expect(second.instanceId).not.toBe(first.instanceId);
  });

  it('B2 (Q5): a hero can hold two instances of one template', () => {
    const inventory = emptyInventoryState(HERO);
    [lastVerdict(0), lastVerdict(1)].forEach((token, index) => {
      inventory.bag[index] = {
        id: `${HERO}:${index}`,
        key: token.type as never,
        type: 'equipment' as never,
        amount: 1,
        token,
      };
    });
    inventory.idSeq = 2;
    expect(inventoryStateSchema.safeParse(inventory).success).toBe(true);
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
