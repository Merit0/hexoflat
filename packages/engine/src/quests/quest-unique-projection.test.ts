import { describe, expect, it } from 'vitest';
import { projectQuestOffer } from './quest-board-projection';
import type { RewardDropContext } from './quest-definition';
import type { QuestOffer } from './quest-offer';
import { counting } from './quest-test-setup';

function offerWith(rewardDropContext?: RewardDropContext): QuestOffer {
  return {
    id: 'offer',
    templateId: 'offer',
    dayId: 1,
    howKey: 'quest.offer.how',
    definition: counting('offer', 'TEST', 1, {
      locations: ['cave'],
      rewards: [{ kind: 'item', itemKey: 'sword', amount: 1 }],
      ...(rewardDropContext ? { rewardDropContext } : {}),
    }),
  } as QuestOffer;
}

describe('DA7-2: the offer projection names the unique template of a reward', () => {
  it('names the template and nothing else of the drop context', () => {
    const projected = projectQuestOffer(
      offerWith({ mapTier: 2, tier: 'unique', templateKey: 'lantern-eater' }),
    );
    expect(projected.uniqueReward).toBe('lantern-eater');
    expect(projected).not.toHaveProperty('rewardDropContext');
  });

  it.each([undefined, { mapTier: 2 }, { mapTier: 2, tier: 'base' }] as const)(
    'adds no field for the base context %o',
    (context) => {
      expect(projectQuestOffer(offerWith(context))).not.toHaveProperty('uniqueReward');
    },
  );
});
