import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executePlayerCommand, type PlayerAggregates } from '../aggregates/execute-player-command';
import { emptyProgressState } from '../aggregates/progress-state';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { EDimension } from '../dimensions/dimensions';
import { HERO, inventoryWith } from '../trade/trade-test-setup';
import { QuestDefinitionSchema, type QuestDefinition } from './quest-definition';
import { ALL_QUESTS } from './all-quests';
import { questContentFailures, questSellValue } from './quests.content';
import { counting } from './quest-test-setup';

const QUEST_ID = 'da5b-unique-quest';
const CATALOGUE = ALL_QUESTS as Record<string, QuestDefinition>;

function uniqueQuest(extra: Partial<QuestDefinition> = {}): QuestDefinition {
  return counting(QUEST_ID, 'TEST', 1, {
    locations: ['cave'],
    repeat: 'once',
    rewards: [{ kind: 'item', itemKey: 'sword', amount: 1 }],
    rewardDropContext: { mapTier: 2, tier: 'unique', templateKey: 'lantern-eater' },
    ...extra,
  });
}

beforeAll(() => {
  CATALOGUE[QUEST_ID] = uniqueQuest();
});
afterAll(() => {
  delete CATALOGUE[QUEST_ID];
});

function readyHero(): PlayerAggregates {
  const progress = emptyProgressState(HERO);
  progress.quests.active.push({ questId: QUEST_ID, progress: 1, state: 'ready' });
  return { inventory: inventoryWith({}), progress };
}

function claim(state: PlayerAggregates) {
  return executePlayerCommand(
    state,
    {
      type: 'QUEST_CLAIM',
      payload: { heroId: HERO, revision: state.inventory.revision, questId: QUEST_ID },
    },
    {
      devGrantAllowed: false,
      inventory: { stashOpen: false, battleOpen: false },
      quest: { atBoard: true },
      rngSeed: 'da5b-server-secret-0123456789',
    },
  );
}

function claimed(state: PlayerAggregates): PlayerAggregates {
  const outcome = claim(state);
  if (!outcome.ok) throw new Error(outcome.code);
  return {
    inventory: outcome.changed.inventory ?? state.inventory,
    progress: outcome.changed.progress ?? state.progress,
  };
}

const uniquesOf = (state: PlayerAggregates) =>
  state.inventory.bag.flatMap((cell) => (cell?.token?.tier === 'unique' ? [cell.token] : []));

describe('DA5b-4 a quest can reward a unique instance', () => {
  it('claiming mints one instance of the named template at the reward tier', () => {
    const tokens = uniquesOf(claimed(readyHero()));
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      uniqueKey: 'lantern-eater',
      type: 'sword',
      tokenType: ETokenType.GLOOM,
      dimension: EDimension.UNDERWORLD,
      mapTier: 2,
      instanceId: expect.stringMatching(/^[0-9a-f]{32}$/) as string,
    });
  });

  it('the same command again gives no second instance, on the old and on the new state', () => {
    const before = readyHero();
    const after = claimed(before);
    expect(claim(after)).toMatchObject({ ok: false, code: 'NOT_ACTIVE' });
    expect(uniquesOf(after)).toHaveLength(1);
    expect(uniquesOf(claimed(before))).toEqual(uniquesOf(after));
  });

  it('a base tier choice and an old context without a tier still reward a base token', () => {
    for (const rewardDropContext of [{ mapTier: 2 }, { mapTier: 2, tier: 'base' }] as const) {
      CATALOGUE[QUEST_ID] = uniqueQuest({ rewardDropContext });
      const state = claimed(readyHero());
      CATALOGUE[QUEST_ID] = uniqueQuest();
      expect(uniquesOf(state)).toEqual([]);
      expect(state.inventory.bag.find((cell) => cell?.token)?.token).toMatchObject({
        tier: 'base',
        type: 'sword',
        mapTier: 2,
      });
    }
  });

  it('a coin reward beside the unique stays a plain stack', () => {
    CATALOGUE[QUEST_ID] = uniqueQuest({
      rewards: [
        { kind: 'item', itemKey: 'coins', amount: 5 },
        { kind: 'item', itemKey: 'sword', amount: 1 },
      ],
    });
    const state = claimed(readyHero());
    CATALOGUE[QUEST_ID] = uniqueQuest();
    expect(uniquesOf(state)).toHaveLength(1);
    expect(state.inventory.bag.find((cell) => cell?.key === 'coins')?.amount).toBe(5);
  });

  it('the schema wants a template for the unique tier and only for it', () => {
    const parses = (rewardDropContext: unknown) =>
      QuestDefinitionSchema.safeParse({ ...uniqueQuest(), rewardDropContext }).success;
    expect(parses({ mapTier: 2, tier: 'unique', templateKey: 'lantern-eater' })).toBe(true);
    expect(parses({ mapTier: 2, tier: 'unique' })).toBe(false);
    expect(parses({ mapTier: 2, tier: 'base', templateKey: 'lantern-eater' })).toBe(false);
    expect(parses({ mapTier: 2, templateKey: 'lantern-eater' })).toBe(false);
  });

  it('content refuses a template the quest cannot grant and prices the reward by it', () => {
    const failures = (extra: Partial<QuestDefinition>) =>
      questContentFailures([uniqueQuest(extra)]);
    const context = (templateKey: string) =>
      ({ rewardDropContext: { mapTier: 2, tier: 'unique', templateKey } }) as const;
    expect(failures({})).toEqual([]);
    expect(failures(context('nobody'))).toEqual([`${QUEST_ID}: unknown unique reward nobody`]);
    expect(failures(context('last-verdict'))).toEqual([
      `${QUEST_ID}: last-verdict drops only by the alien roll`,
    ]);
    expect(failures({ locations: ['silesia'] })).toEqual([
      `${QUEST_ID}: unique reward lantern-eater is outside its dimension`,
    ]);
    expect(failures({ rewards: [{ kind: 'item', itemKey: 'shield', amount: 1 }] })).toEqual([
      `${QUEST_ID}: a unique reward needs exactly one sword reward`,
    ]);
    expect(questSellValue(uniqueQuest())).toBe(360);
    expect(failures({ repeat: 'repeatable', maxSellValue: 359 })).toEqual([
      `${QUEST_ID}: reward sells for 360 over 359`,
    ]);
  });
});
