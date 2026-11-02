import type { DomainEvent } from '../commands/types';
import { generateHallQuestion } from '../knowledge/math';
import type { RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';
import type { BattleRules } from './battle-content';
import type { BattleState, BattleTask, TaskKind } from './battle-state';
import { reject, type BattleRejection } from './battle-rejection';

const OPTION_COUNT = 4;
const MAX_OFFSET = 9;

function shuffled<T>(items: T[], rng: RandomNumberGenerator): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function taskOptions(answer: number, rng: RandomNumberGenerator): number[] {
  const offsets = Array.from({ length: MAX_OFFSET }, (_, i) => i + 1).flatMap((d) => [d, -d]);
  const distractors = shuffled(offsets, rng)
    .map((d) => answer + d)
    .filter((n) => n > 0)
    .slice(0, OPTION_COUNT - 1);
  return shuffled([answer, ...distractors], rng);
}

export type TaskExtras = Pick<BattleTask, 'targetId' | 'backHex' | 'pusherHex'>;

export function issueTask(
  state: BattleState,
  kind: TaskKind,
  creatureId: string,
  atMs: number,
  rules: BattleRules,
  extras: TaskExtras = {},
): DomainEvent[] {
  state.taskSeq += 1;
  const question = generateHallQuestion(
    `${state.seed}:battle:${state.id}:task`,
    state.taskSeq,
    state.taskHistory ?? {},
    [],
  );
  const options = taskOptions(
    question.answer,
    deriveStream(state.seed, `battle:${state.id}:task:${state.taskSeq}`),
  );
  const task: BattleTask = {
    id: `${state.id}:task:${state.taskSeq}`,
    kind,
    creatureId,
    question: { operation: question.operation, lhs: question.lhs, rhs: question.rhs },
    options,
    answer: question.answer,
    issuedAtMs: atMs,
    deadlineMs: atMs + rules.taskMs,
    ...extras,
  };
  state.task = task;
  state.undo = [];
  return [
    {
      type: 'TASK_ISSUED',
      payload: {
        taskId: task.id,
        kind,
        creatureId,
        question: task.question,
        options: task.options,
        deadlineMs: task.deadlineMs,
      },
    },
  ];
}

export interface TaskGrade {
  task: BattleTask;
  correct: boolean;
  late: boolean;
}

export function gradeTask(
  state: BattleState,
  creatureId: string,
  option: number | null,
  atMs: number,
): TaskGrade | BattleRejection {
  const task = state.task;
  if (!task) return reject('NO_TASK');
  if (task.creatureId !== creatureId) return reject('NOT_YOUR_TURN');
  const late = atMs > task.deadlineMs;
  const picked = option === null ? null : task.options[option];
  state.task = undefined;
  return { task, late, correct: !late && picked === task.answer };
}
