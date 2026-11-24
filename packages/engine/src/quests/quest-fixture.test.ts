import { describe, expect, it } from 'vitest';
import { emptyProgressState, type ProgressState } from '../aggregates/progress-state';
import { HERO } from '../trade/trade-test-setup';
import { ALL_QUESTS } from './all-quests';
import { projectQuestOffer } from './quest-board-projection';
import { applyQuestFixture, questFixtureSchema } from './quest-fixture';
import { QUEST_BOARD_SIZE, type QuestOffer } from './quest-offer';
import { questContentFailures } from './quests.content';

function onBoard(offers: QuestOffer[] = []): ProgressState {
  const progress = emptyProgressState(HERO);
  progress.quests.board = { dayId: 4, issued: 0, refreshes: 0 };
  progress.quests.offers = offers;
  return progress;
}

function forced(progress: ProgressState): ProgressState {
  const next = applyQuestFixture(progress, { uniqueReward: true });
  if (!next) throw new Error('fixture refused');
  return next;
}

const uniqueOffer = (progress: ProgressState) =>
  progress.quests.offers!.find(({ templateId }) => templateId === 'bone-hunter')!;

describe('DA8 the unique reward quest fixture', () => {
  it('offers a valid quest of the hero day that rewards the lantern-eater', () => {
    const offer = uniqueOffer(forced(onBoard()));
    expect(offer.dayId).toBe(4);
    expect(projectQuestOffer(offer).uniqueReward).toBe('lantern-eater');
    expect(questContentFailures([{ ...offer.definition, repeat: 'once' }])).toEqual([]);
  });

  it('keeps the board size and gives a new id after a completion', () => {
    const first = forced(onBoard());
    const filler = (index: number): QuestOffer => ({
      ...uniqueOffer(first),
      id: `qo-${String(index).padStart(32, '0')}`,
      templateId: `filler-${index}`,
    });
    const full = onBoard(Array.from({ length: QUEST_BOARD_SIZE }, (_, index) => filler(index)));
    expect(forced(full).quests.offers).toHaveLength(QUEST_BOARD_SIZE);
    const done = onBoard();
    done.quests.done['bone-hunter'] = 1;
    expect(uniqueOffer(forced(done)).id).not.toBe(uniqueOffer(first).id);
  });

  it('refuses a board that was never opened and a fixture quest that is already taken', () => {
    expect(applyQuestFixture(emptyProgressState(HERO), { uniqueReward: true })).toBeNull();
    const taken = forced(onBoard());
    taken.quests.active.push({ questId: uniqueOffer(taken).id, progress: 0, state: 'active' });
    expect(applyQuestFixture(taken, { uniqueReward: true })).toBeNull();
  });

  it('is never part of the content and accepts only the literal switch', () => {
    const uniqueContent = Object.values(ALL_QUESTS).filter(
      ({ rewardDropContext }) => rewardDropContext && 'tier' in rewardDropContext,
    );
    expect(uniqueContent).toEqual([]);
    expect(questFixtureSchema.safeParse({ uniqueReward: 'last-verdict' }).success).toBe(false);
  });
});
