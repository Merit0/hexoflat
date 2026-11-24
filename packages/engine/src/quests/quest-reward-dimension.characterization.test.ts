import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { EDimension } from '../dimensions/dimensions';
import { QuestDefinitionSchema, type QuestDefinition } from './quest-definition';
import { planClaim } from './quest-log';
import { catalogueWith, counting, inventoryWith, progressWith } from './quest-test-setup';

const RNG_SEED = 'da2-quest-reward-secret-0123456789';

function swordQuest(extra: Partial<QuestDefinition> = {}): QuestDefinition {
  return counting('da2-reward', 'TEST', 1, {
    rewards: [{ kind: 'item', itemKey: 'sword', amount: 1 }],
    ...extra,
  });
}

function claimedToken(quest: QuestDefinition) {
  const progress = progressWith(50);
  progress.quests.active = [{ questId: quest.id, progress: 1, state: 'ready' }];
  const result = planClaim(progress, inventoryWith([]), quest.id, {
    atBoard: true,
    catalogue: catalogueWith(quest),
    rngSeed: RNG_SEED,
  });
  if (!result.ok) throw new Error('claim refused');
  const token = result.inventory!.bag.find((cell) => cell?.token)?.token;
  expect(token).toBeDefined();
  return token!;
}

describe('C7/F9 (DA5a-2): a quest item reward takes the dimension of the quest location', () => {
  it('an EARTH location without rewardDropContext rewards an EARTH idol token of tier 1', () => {
    expect(claimedToken(swordQuest())).toMatchObject({
      dimension: EDimension.EARTH,
      tokenType: ETokenType.IDOL,
      mapTier: 1,
      tier: 'base',
    });
  });

  it('an UNDERWORLD location without rewardDropContext rewards a gloom token of tier 1', () => {
    const quest = swordQuest({ locations: ['cave'] });
    expect(claimedToken(quest)).toMatchObject({
      dimension: EDimension.UNDERWORLD,
      tokenType: ETokenType.GLOOM,
      mapTier: 1,
    });
  });

  it.each([
    [['silesia'], EDimension.EARTH, ETokenType.IDOL],
    [['cave'], EDimension.UNDERWORLD, ETokenType.GLOOM],
  ] as const)(
    'rewardDropContext changes only the tier, never the dimension of %j',
    (locations, dimension, tokenType) => {
      const quest = swordQuest({
        locations: [...locations],
        rewardDropContext: { mapTier: 3 },
      });
      expect(claimedToken(quest)).toMatchObject({ dimension, tokenType, mapTier: 3 });
    },
  );

  it('a definition can state neither a dimension nor a token type of the reward', () => {
    const quest = swordQuest();
    expect(QuestDefinitionSchema.safeParse(quest).success).toBe(true);
    expect(QuestDefinitionSchema.safeParse({ ...quest, dimension: EDimension.EARTH }).success).toBe(
      false,
    );
    expect(
      QuestDefinitionSchema.safeParse({
        ...quest,
        rewardDropContext: { tokenType: ETokenType.SPARK, mapTier: 3 },
      }).success,
    ).toBe(false);
  });
});
