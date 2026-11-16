import type { QuestRun } from './quest-state';

export function questAnswerReview(run: QuestRun): boolean[] | undefined {
  if (
    run.path.length < run.terms.length &&
    run.phase !== 'lost' &&
    run.phase !== 'collect' &&
    run.phase !== 'ambush'
  )
    return undefined;
  return run.path.map((step, index) => step.number === run.terms[index]);
}
