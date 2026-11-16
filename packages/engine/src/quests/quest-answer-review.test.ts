import { describe, expect, it } from 'vitest';
import { projectQuestForClient } from './projection';
import { seekerGiveUp, seekerStep } from './seeker-actions';
import { decoyHexAround, followTruth, must, startQuest } from './seeker-test-setup';

describe('answer review after the path ends', () => {
  it('reveals neither correct nor mistaken answers while walking', () => {
    const state = startQuest('seeker-1', 'indistinct');
    const right = followTruth(state, 1);
    const wrong = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board),
    );
    expect(wrong.run.phase).toBe('walking');
    expect(projectQuestForClient(right.run)).not.toHaveProperty('answerReview');
    expect(projectQuestForClient(wrong.run)).not.toHaveProperty('answerReview');
  });

  it('marks every answer correct when the whole true path is complete', () => {
    const state = startQuest('seeker-1', 'review');
    const end = followTruth(state, state.run.terms.length);
    expect(projectQuestForClient(end.run).answerReview).toEqual(end.run.path.map(() => true));
  });

  it('marks each wrong number and preserves the review when leaving a lost path', () => {
    const state = startQuest('seeker-1', 'review');
    const end = followTruth(state, state.run.terms.length);
    end.run.chest = null;
    end.run.phase = 'lost';
    end.run.path[2].number += 99;
    end.run.path[5].number += 99;
    const expected = end.run.path.map((_, index) => index !== 2 && index !== 5);
    expect(projectQuestForClient(end.run).answerReview).toEqual(expected);
    const left = must(seekerGiveUp(end.progress, end.run));
    expect(left.events[0].payload).toMatchObject({ recap: { answerReview: expected } });
  });
});
