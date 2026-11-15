import { describe, expect, it } from 'vitest';
import { offsetToAxial } from '../utils/hex-utils';
import { ALL_QUESTS } from './all-quests';
import { questBoardState } from './quest-log';
import { projectQuestForClient } from './projection';
import { seekerGiveUp, seekerReturn, seekerStepBack } from './seeker-actions';
import { followTruth, must, openChestOf, startQuest } from './seeker-test-setup';

function atChest(seed: string) {
  const state = startQuest('seeker-1', seed);
  return { state, end: followTruth(state, 10) };
}

describe('QC1 characterization: what the quest chest kept and what the loot adapter changed', () => {
  it('OPEN of the real chest turns the phase to collect, announces the chest hex, spends no Will', () => {
    const { state, end } = atChest('char-a');
    const opened = must(openChestOf(state, end));
    expect(opened.run.phase).toBe('collect');
    expect(opened.progress).toEqual(end.progress);
    expect(opened.events[0]).toMatchObject({
      type: 'CONTAINER_OPENED',
      payload: {
        actorId: end.progress.knowledge.heroId,
        kind: 'quest-chest',
        hex: offsetToAxial(end.run.chest!.hex),
      },
    });
    expect({
      ...opened.run,
      phase: 'walking',
      collect: null,
      chest: end.run.chest,
    }).toEqual(end.run);
  });

  it('the collect phase still refuses a step back and giving up; OPEN again is refused on the empty chest', () => {
    const { state, end } = atChest('char-b');
    const opened = must(openChestOf(state, end));
    expect(seekerStepBack(opened.progress, opened.run, state.board)).toMatchObject({
      reason: 'WRONG_PHASE',
    });
    expect(seekerGiveUp(opened.progress, opened.run)).toMatchObject({ reason: 'WRONG_PHASE' });
    expect(openChestOf(state, { progress: opened.progress, run: opened.run })).toMatchObject({
      reason: 'STANDING_ON_TARGET',
    });
  });

  it('RETURN counts the milestone once, frees the slot and opens the next card', () => {
    const { state, end } = atChest('char-c');
    const opened = must(openChestOf(state, end));
    const left = must(seekerReturn(opened.progress, opened.run));
    expect(left.run.phase).toBe('ended');
    expect(left.run.outcome).toBe('treasure');
    expect(left.progress.quests.done['seeker-1']).toBe(1);
    expect(left.progress.quests.active).toEqual([]);
    expect(questBoardState(left.progress.quests, ALL_QUESTS['seeker-2'])).toBe('open');
    expect(left.events.map((event) => event.type)).toEqual(['QUEST_COMPLETED', 'QUEST_SUMMARY']);
  });

  it('RETURN is refused while still walking', () => {
    const { end } = atChest('char-d');
    expect(seekerReturn(end.progress, end.run)).toMatchObject({ reason: 'WRONG_PHASE' });
  });

  it('the projection shows the chest as a bare hex before OPEN; after it the hero stands on the emptied chest', () => {
    const { state, end } = atChest('char-e');
    const before = projectQuestForClient(end.run);
    expect(before.chest).toEqual({ hex: end.run.chest!.hex, empty: false });
    const opened = must(openChestOf(state, end));
    const after = projectQuestForClient(opened.run);
    expect(after.phase).toBe('collect');
    expect(after.position).toEqual(end.run.chest!.hex);
    expect(after.chest).toEqual({ hex: end.run.chest!.hex, empty: true });
  });
});
