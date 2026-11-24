import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { EDimension } from '../dimensions/dimensions';
import type { DropContext } from '../tokens/drop-context';
import type { QuestDefinition } from './quest-definition';
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

describe('DA2 C7/F9: dimension of a quest item reward (quest-log.ts:206-209)', () => {
  it('CURRENT (F9): an EARTH quest without rewardDropContext rewards an EARTH idol token of tier 1', () => {
    expect(claimedToken(swordQuest())).toMatchObject({
      dimension: EDimension.EARTH,
      tokenType: ETokenType.IDOL,
      mapTier: 1,
      tier: 'base',
    });
  });

  it('CURRENT (F9): an UNDERWORLD quest without rewardDropContext rewards a gloom token (quest.dimension)', () => {
    const quest = swordQuest({ dimension: EDimension.UNDERWORLD, locations: ['cave'] });
    expect(claimedToken(quest)).toMatchObject({
      dimension: EDimension.UNDERWORLD,
      tokenType: ETokenType.GLOOM,
      mapTier: 1,
    });
  });

  it('CURRENT (F9): rewardDropContext overrides quest.dimension and the tier', () => {
    const rewardDropContext: DropContext = { tokenType: ETokenType.SPARK, mapTier: 3 };
    expect(claimedToken(swordQuest({ rewardDropContext }))).toMatchObject({
      dimension: EDimension.HEAVEN,
      tokenType: ETokenType.SPARK,
      mapTier: 3,
    });
  });
});
