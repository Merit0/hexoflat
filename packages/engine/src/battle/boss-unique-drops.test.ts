import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { rollUniqueDrops, type UniqueDropOverride } from '../containers/unique-drops';
import { LOOT_TABLES, SKELETON_KING_TABLE_ID, lootTableOf } from '../content/loot-tables.content';
import { ALIEN_UNIQUE_CHANCE_BP } from '../content/unique-rules.content';
import { bossAlienProblems, lootTableProblems } from '../content/validate-loot';
import { EDimension } from '../dimensions/dimensions';
import type { LootDrop, LootTable } from '../loot';
import { emptyInventoryState } from '../inventory/inventory-state';
import { locationDropContext } from '../registry/location-drop-context';
import { applyBattleFixture } from './battle-fixtures';
import { BATTLE_CREATURES } from './battle-catalogue';
import { battleStateSchema, type BattleState } from './battle-state';
import { enterCollectPhase } from './collect';
import { fight, king, lootAt, ORIGIN, play, TARGET, warrior } from './collect-test-setup';
import { createGraveContainer } from './grave-contents';
import { projectBattleForViewer } from './projection';

const RULED_TABLE_ID = 'da5b-ruled-boss';
const RULED_KIND = 'da5b-ruled-boss';
const KINDS = {
  [EDimension.EARTH]: 'da5b-earth-boss',
  [EDimension.HEAVEN]: 'da5b-heaven-boss',
  [EDimension.UNDERWORLD]: 'da5b-underworld-boss',
} as const;
const tables = LOOT_TABLES as Record<string, LootTable>;

beforeAll(() => {
  const boss = BATTLE_CREATURES['skeleton-king'];
  for (const [dimension, kind] of Object.entries(KINDS))
    BATTLE_CREATURES[kind] = { ...boss, dimension: dimension as EDimension };
  BATTLE_CREATURES[RULED_KIND] = { ...boss, lootTableId: RULED_TABLE_ID };
  ruled(10_000);
});

afterAll(() => {
  for (const kind of [...Object.values(KINDS), RULED_KIND]) delete BATTLE_CREATURES[kind];
  delete tables[RULED_TABLE_ID];
});

function ruled(chanceBp: number, extra: Partial<LootTable> = {}): void {
  tables[RULED_TABLE_ID] = {
    ...tables[SKELETON_KING_TABLE_ID],
    id: RULED_TABLE_ID,
    alienRoll: undefined,
    uniqueDrops: [{ uniqueKey: 'lantern-eater', chanceBp }],
    ...extra,
  };
}

function killed(kind: string, id: string, override?: UniqueDropOverride): BattleState {
  const state = fight([{ ...king('e1', TARGET), kind }], { id });
  state.creatures.find((creature) => creature.id === 'e1')!.hp = 0;
  state.phase = 'ended';
  state.outcome = 'victory';
  state.uniqueDropOverride = override;
  enterCollectPhase(state);
  return state;
}

function dropsOf(state: BattleState): LootDrop[] {
  return state.collect!.graves.flatMap((grave) => grave.container!.contents!.flat());
}

const uniquesOf = (drops: LootDrop[]) => drops.filter((drop) => drop.token?.tier === 'unique');
const baseOf = (drops: LootDrop[]) => drops.filter((drop) => drop.token?.tier !== 'unique');

const IDS = Array.from({ length: 40 }, (_, index) => `da5b-${index}`);

describe('DA5b-1 a boss grave holds the base loot plus a unique by the rules of its table', () => {
  it.each(IDS.slice(0, 12))('10000 bp adds exactly one instance to the base loot (%s)', (id) => {
    ruled(0);
    const base = dropsOf(killed(RULED_KIND, id));
    ruled(10_000);
    const drops = dropsOf(killed(RULED_KIND, id));
    expect(uniquesOf(base)).toEqual([]);
    expect(base.length).toBeGreaterThan(0);
    expect(baseOf(drops)).toEqual(base);
    const [unique, ...others] = uniquesOf(drops);
    expect(others).toEqual([]);
    expect(unique).toMatchObject({ itemKey: 'sword', amount: 1, guaranteed: true });
    expect(unique.token).toMatchObject({
      uniqueKey: 'lantern-eater',
      tokenType: ETokenType.GLOOM,
      dimension: EDimension.UNDERWORLD,
      mapTier: locationDropContext('cave').mapTier,
      instanceId: expect.stringMatching(/^[0-9a-f]{32}$/) as string,
    });
  });

  it('two kills give two independent instances and the same kill gives the same one', () => {
    ruled(10_000);
    const instance = (id: string) => uniquesOf(dropsOf(killed(RULED_KIND, id)))[0].token!;
    expect(instance('da5b-a').instanceId).not.toBe(instance('da5b-b').instanceId);
    expect(instance('da5b-a')).toEqual(instance('da5b-a'));
  });

  it('a template of another dimension does not drop from the boss', () => {
    ruled(10_000);
    BATTLE_CREATURES[RULED_KIND] = { ...BATTLE_CREATURES[RULED_KIND], dimension: EDimension.EARTH };
    const drops = dropsOf(killed(RULED_KIND, 'da5b-earth'));
    BATTLE_CREATURES[RULED_KIND] = {
      ...BATTLE_CREATURES[RULED_KIND],
      dimension: EDimension.UNDERWORLD,
    };
    expect(uniquesOf(drops)).toEqual([]);
  });

  it('opening the grave lays the instance on the field, or in the bag, and never loses it', () => {
    ruled(10_000);
    const state = killed(RULED_KIND, 'da5b-open');
    const { instanceId } = uniquesOf(dropsOf(state))[0].token!;
    expect(state.creatures.find((creature) => creature.side === 'heroes')!.pos).toEqual(ORIGIN);
    const opened = play(state, lootAt(TARGET), emptyInventoryState('hero'));
    expect(opened.refused).toBeNull();
    const found = [...opened.battle.collect!.items, ...opened.inventory!.bag].filter(
      (entry) => entry?.token?.tier === 'unique',
    );
    expect(found.map((entry) => entry!.token!.instanceId)).toEqual([instanceId]);
  });
});

describe('DA5b-2 the Alien drops from a boss of any dimension, at most once per kill', () => {
  it.each([EDimension.EARTH, EDimension.HEAVEN, EDimension.UNDERWORLD] as const)(
    '10000 bp gives one Alien from a boss of %s and 0 bp gives none',
    (dimension) => {
      for (const id of IDS) {
        const aliens = uniquesOf(dropsOf(killed(KINDS[dimension], id, { chanceBp: 10_000 })));
        expect(aliens).toHaveLength(1);
        expect(aliens[0].token).toMatchObject({
          tokenType: ETokenType.ALIEN,
          dimension: EDimension.NOWHERE,
          uniqueKey: 'last-verdict',
        });
        const none = killed(KINDS[dimension], id, { chanceBp: 0 });
        expect(uniquesOf(dropsOf(none))).toEqual([]);
        expect(dropsOf(none)).toEqual(
          baseOf(dropsOf(killed(KINDS[dimension], id, { chanceBp: 10_000 }))),
        );
      }
    },
  );

  it('the named roll and the Alien roll are independent: both can hit, still one Alien', () => {
    ruled(10_000, { alienRoll: true });
    const drops = uniquesOf(dropsOf(killed(RULED_KIND, 'da5b-both', { chanceBp: 10_000 })));
    expect(drops.map((drop) => drop.token!.uniqueKey)).toEqual(['lantern-eater', 'last-verdict']);
    expect(new Set(drops.map((drop) => drop.token!.id)).size).toBe(2);
  });

  it('an ordinary enemy carries no unique roll even when the chance is forced', () => {
    const state = fight([warrior('e1', TARGET)], { id: 'da5b-warrior' });
    state.creatures.find((creature) => creature.id === 'e1')!.hp = 0;
    state.uniqueDropOverride = { chanceBp: 10_000 };
    enterCollectPhase(state);
    expect(uniquesOf(dropsOf(state))).toEqual([]);
  });

  it('content: every boss table has the Alien roll and an Alien cannot be a named rule', () => {
    const owner = [{ owner: 'boss:x', tableId: RULED_TABLE_ID }];
    ruled(10);
    expect(bossAlienProblems(owner, LOOT_TABLES)).toEqual([
      '[boss:x] a boss table needs the alien roll',
    ]);
    ruled(10, { uniqueDrops: [{ uniqueKey: 'last-verdict', chanceBp: 10 }] });
    expect(lootTableProblems({ [RULED_TABLE_ID]: tables[RULED_TABLE_ID] }, () => 20)).toEqual([
      `[loot:${RULED_TABLE_ID}] last-verdict drops only by the alien roll`,
    ]);
    ruled(10, { uniqueDrops: [{ uniqueKey: 'nobody', chanceBp: 10 }] });
    expect(lootTableProblems({ [RULED_TABLE_ID]: tables[RULED_TABLE_ID] }, () => 20)).toEqual([
      `[loot:${RULED_TABLE_ID}] unknown unique nobody`,
    ]);
  });
});

describe('DA5b-3 the real chance of an Alien', () => {
  const KILLS = 10_000;
  const SIGMAS = 4;

  it('10 000 seeded kills of the Skeleton King stay within four sigmas of 50 bp', () => {
    const chance = ALIEN_UNIQUE_CHANCE_BP / 10_000;
    const state = killed('skeleton-king', 'da5b-rate');
    const grave = { ...state.collect!.graves[0], container: undefined };
    let aliens = 0;
    for (let kill = 0; kill < KILLS; kill += 1) {
      state.id = `da5b-rate-${kill}`;
      const drops = uniquesOf(createGraveContainer(state, grave).contents!.flat());
      expect(drops.length).toBeLessThanOrEqual(1);
      if (drops[0]?.token?.tokenType === ETokenType.ALIEN) aliens += 1;
    }
    const bound = SIGMAS * Math.sqrt(KILLS * chance * (1 - chance));
    expect(ALIEN_UNIQUE_CHANCE_BP).toBe(50);
    expect(Math.abs(aliens - KILLS * chance)).toBeLessThanOrEqual(bound);
  }, 120_000);
});

describe('the force hook is a fixture for one carrier event and never reaches the client', () => {
  it('forces the first boss grave of the battle, is spent by it and survives a save before', () => {
    const open = fight([king('e1', TARGET)], { id: 'da5b-hook' });
    open.lootEnabled = true;
    const forced = battleStateSchema.parse(
      JSON.parse(JSON.stringify(applyBattleFixture(open, { kind: 'force-unique-drops' }))),
    );
    expect(forced.uniqueDropOverride).toEqual({ chanceBp: 10_000 });
    expect(JSON.stringify(projectBattleForViewer(forced, 'heroes'))).not.toMatch(
      /uniqueDropOverride|chanceBp/,
    );
    const won = applyBattleFixture(forced, { kind: 'finish', outcome: 'victory' });
    expect(won.uniqueDropOverride).toBeUndefined();
    expect(uniquesOf(dropsOf(won)).map((drop) => drop.token!.uniqueKey)).toEqual(['last-verdict']);
    expect(open.uniqueDropOverride).toBeUndefined();
  });

  it('a second boss of the same battle rolls at the real chance', () => {
    const state = fight([king('e1', TARGET), king('e2', { q: -1, r: 0 })], { id: 'da5b-two' });
    for (const creature of state.creatures) if (creature.side === 'enemies') creature.hp = 0;
    state.uniqueDropOverride = { chanceBp: 10_000 };
    enterCollectPhase(state);
    const counts = state.collect!.graves.map(
      (grave) => uniquesOf(grave.container!.contents!.flat()).length,
    );
    expect(counts).toEqual([1, 0]);
  });

  it('a table without rules rolls nothing', () => {
    expect(
      rollUniqueDrops({
        table: lootTableOf('cave-chest-loot')!,
        mint: {
          seed: 'da5b-plain-seed-0123456789',
          sourceId: 'chest:da5b',
          dropContext: locationDropContext('cave'),
        },
        seed: 'da5b-plain-seed-0123456789',
        streamLabel: 'da5b',
        override: { chanceBp: 10_000 },
      }),
    ).toEqual([]);
  });
});
