import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import type { QuestRun, SeekerOutcome } from './quest-state';
import { removeQuest } from './quest-board-state';
import { projectQuestOffer } from './quest-board-projection';
import { questAnswerReview } from './quest-answer-review';

export function resolveSeekerPath(progress: ProgressState, run: QuestRun): DomainEvent[] {
  if (run.resolution || (!run.chest && run.phase !== 'lost')) return [];
  run.resolution = run.lines.length === 0 ? 'treasure' : 'lost';
  const templateId = run.generatedOffer?.templateId ?? run.offerId;
  removeQuest(progress.quests, run.offerId);
  if (run.resolution === 'treasure')
    progress.quests.done[templateId] = (progress.quests.done[templateId] ?? 0) + 1;
  return [
    {
      type: 'QUEST_RESOLVED',
      payload: { heroId: progress.knowledge.heroId, questId: run.offerId, outcome: run.resolution },
    },
  ];
}

export function finishSeekerRun(
  progress: ProgressState,
  run: QuestRun,
  outcome: SeekerOutcome,
  reason: string | null,
): { progress: ProgressState; events: DomainEvent[] } {
  const next = structuredClone(progress);
  const templateId = run.generatedOffer?.templateId ?? run.offerId;
  removeQuest(
    next.quests,
    run.offerId,
    run.stepsTaken > 0 || run.generatedOffer?.dayId !== next.day?.id,
  );
  if (run.resolution) {
    outcome = run.resolution;
    reason = outcome === 'treasure' ? null : 'TREASURE_LOST';
  }
  if (outcome === 'treasure' && !run.resolution) {
    next.quests.done[templateId] = (next.quests.done[templateId] ?? 0) + 1;
  }
  const answerReview = questAnswerReview(run);
  run.phase = 'ended';
  run.outcome = outcome;
  const heroId = next.knowledge.heroId;
  const recap = {
    numbers: run.path.map((step) => step.number),
    firstDeviation: run.firstDeviation,
    ...(answerReview ? { answerReview } : {}),
  };
  const closing: DomainEvent =
    reason === null
      ? { type: 'QUEST_COMPLETED', payload: { heroId, questId: run.offerId, outcome, recap } }
      : { type: 'QUEST_FAILED', payload: { heroId, questId: run.offerId, reason, recap } };
  const summary: DomainEvent = {
    type: 'QUEST_SUMMARY',
    payload: {
      offerId: run.offerId,
      ...(run.generatedOffer ? { offer: projectQuestOffer(run.generatedOffer) } : {}),
      selfSteps: run.stepsTaken,
      deviationsTotal: run.deviationsTotal,
      outcome,
    },
  };
  return { progress: next, events: [closing, summary] };
}
