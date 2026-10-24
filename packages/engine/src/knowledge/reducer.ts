import type { KnowledgeAction, KnowledgeCommand, KnowledgeContext } from './commands';
import {
  correctCount,
  reviewQuestions,
  type HallSession,
  type KnowledgeState,
  type ReturnSession,
} from './state';
import {
  generateHallQuestion,
  generateQuestions,
  hallAward,
  KNOWLEDGE_RULES,
  stepCost,
} from './math';
import { willZoneCharges } from './will-zone';
import { grantWill, spendWill } from './will';
import type { DomainEvent } from '../commands/types';

function available(mode: 'hall' | 'return', state: KnowledgeState, ctx: KnowledgeContext): boolean {
  if (ctx.combatActive || ctx.moving) return false;
  return mode === 'hall'
    ? !willZoneCharges(ctx) && ctx.atBook
    : willZoneCharges(ctx) && state.current < stepCost(ctx);
}

function start(
  state: KnowledgeState,
  action: Extract<KnowledgeAction, { kind: 'start' }>,
  ctx: KnowledgeContext,
): boolean {
  if (!available(action.mode, state, ctx)) return false;
  if (action.mode === 'hall' && state.current >= state.capacity) return false;
  const previous = state.session;
  if (
    previous &&
    !(action.mode === 'return' && previous.mode === 'hall') &&
    !['done', 'returned'].includes(previous.status) &&
    !(
      previous.mode === 'return' &&
      previous.status === 'result' &&
      correctCount(previous) < KNOWLEDGE_RULES.returnMinCorrect
    )
  )
    return false;
  state.sequence++;
  const id = `${state.heroId}:${state.sequence}`;
  state.session =
    action.mode === 'hall'
      ? {
          id,
          mode: 'hall',
          seed: action.seed,
          originMapId: ctx.mapId,
          status: 'question',
          index: 0,
          question: generateHallQuestion(action.seed, 0, state.history, []),
          answer: null,
          correct: 0,
          earned: 0,
          lastAward: 0,
          recent: [],
        }
      : {
          id,
          mode: 'return',
          seed: action.seed,
          questions: generateQuestions(action.seed),
          answers: [],
          index: 0,
          status: 'question',
          originMapId: ctx.mapId,
          reviewIndex: 0,
          assisted: false,
        };
  return true;
}

function recordFact(state: KnowledgeState, factKey: string, correct: boolean): void {
  state.history[factKey] = [...(state.history[factKey] ?? []), correct].slice(-10);
}

function answerHall(
  state: KnowledgeState,
  session: HallSession,
  action: Extract<KnowledgeAction, { kind: 'answer' }>,
  willEvents: DomainEvent[],
): boolean {
  const { question } = session;
  if (
    session.status !== 'question' ||
    question.id !== action.questionId ||
    !question.options.includes(action.answer)
  )
    return false;
  const correct = action.answer === question.answer;
  const granted = correct
    ? grantWill(state, hallAward(action.elapsedMs), {
        kind: 'hall',
        ref: `${session.id}:${session.index}`,
      })
    : [];
  willEvents.push(...granted);
  const awarded = granted.reduce(
    (sum, event) => sum + (event.payload as { amount: number }).amount,
    0,
  );
  recordFact(state, question.factKey, correct);
  session.answer = action.answer;
  session.correct += correct ? 1 : 0;
  session.lastAward = awarded;
  session.earned += awarded;
  session.status = 'feedback';
  return true;
}

function nextHall(
  state: KnowledgeState,
  session: HallSession,
  action: Extract<KnowledgeAction, { kind: 'next' }>,
): boolean {
  if (session.status !== 'feedback' || session.question.id !== action.questionId) return false;
  if (state.current >= state.capacity) {
    session.status = 'done';
    return true;
  }
  session.recent = [...session.recent, session.question.factKey].slice(
    -KNOWLEDGE_RULES.hallRecentFacts,
  );
  session.index++;
  session.question = generateHallQuestion(
    session.seed,
    session.index,
    state.history,
    session.recent,
  );
  session.answer = null;
  session.lastAward = 0;
  session.status = 'question';
  return true;
}

function finishAnswer(state: KnowledgeState, session: ReturnSession): void {
  if (session.index < 19) {
    session.index++;
    session.status = 'question';
    return;
  }
  session.status = 'result';
  if (correctCount(session) < KNOWLEDGE_RULES.returnMinCorrect) state.failedReturns++;
}

function transition(
  state: KnowledgeState,
  action: KnowledgeAction,
  ctx: KnowledgeContext,
  willEvents: DomainEvent[],
): boolean {
  if (action.kind === 'open') {
    if (!available('hall', state, ctx)) return false;
    if (state.session?.status !== 'returning') state.session = null;
    return true;
  }
  if (action.kind === 'step') {
    if (!willZoneCharges(ctx)) return true;
    const ref = action.target
      ? `${action.target.columnIndex}:${action.target.rowIndex}`
      : ctx.mapId;
    const spent = spendWill(state, stepCost(ctx), 'step', ref);
    willEvents.push(...spent.events);
    if (!spent.ok) return false;
    if (action.target)
      state.lastStep = { ...action.target, mapId: ctx.mapId, revision: state.revision + 1 };
    return true;
  }
  if (action.kind === 'start') return start(state, action, ctx);
  const session = state.session;
  if (!session || session.id !== action.sessionId) return false;
  if (action.kind === 'returned') {
    if (
      session.mode !== 'return' ||
      session.status !== 'returning' ||
      ctx.locationKey !== 'camping'
    )
      return false;
    session.status = 'returned';
    state.failedReturns = 0;
    return true;
  }
  if (!available(session.mode, state, ctx) || ctx.mapId !== session.originMapId) return false;
  if (session.mode === 'hall') {
    if (action.kind === 'answer') return answerHall(state, session, action, willEvents);
    return action.kind === 'next' ? nextHall(state, session, action) : false;
  }
  return transitionReturn(state, session, action);
}

function transitionReturn(
  state: KnowledgeState,
  session: ReturnSession,
  action: KnowledgeAction,
): boolean {
  const question = session.questions[session.index];
  switch (action.kind) {
    case 'answer':
      if (
        session.status !== 'question' ||
        question.id !== action.questionId ||
        !question.options.includes(action.answer) ||
        session.answers.length !== session.index
      )
        return false;
      session.answers.push(action.answer);
      session.status = 'feedback';
      return true;
    case 'next':
      if (session.status !== 'feedback' || question.id !== action.questionId) return false;
      finishAnswer(state, session);
      return true;
    case 'review': {
      if (
        session.status !== 'result' ||
        correctCount(session) >= 17 ||
        action.index !== session.reviewIndex ||
        session.reviewIndex >= KNOWLEDGE_RULES.reviewCount
      )
        return false;
      if (reviewQuestions(session)[session.reviewIndex].answer !== action.answer) return false;
      session.reviewIndex++;
      return true;
    }
    case 'return':
      return prepareReturn(state, action.assisted);
    default:
      return false;
  }
}

export function applyKnowledgeCommand(
  state: KnowledgeState,
  command: KnowledgeCommand,
  ctx: KnowledgeContext,
): DomainEvent[] {
  const { heroId, revision, action } = command.payload;
  const willEvents: DomainEvent[] = [];
  if (
    heroId !== state.heroId ||
    revision !== state.revision ||
    !transition(state, action, ctx, willEvents)
  ) {
    return [
      { type: 'KNOWLEDGE_REJECTED', payload: { heroId, action: action.kind } },
      ...willEvents,
    ];
  }
  state.revision++;
  return [
    {
      type: 'KNOWLEDGE_CHANGED',
      payload: { heroId, action: action.kind, revision: state.revision },
    },
    ...willEvents,
  ];
}

function prepareReturn(state: KnowledgeState, assisted: boolean): boolean {
  const session = state.session;
  if (session?.mode !== 'return' || session.status !== 'result' || session.answers.length !== 20)
    return false;
  const passed = correctCount(session) >= KNOWLEDGE_RULES.returnMinCorrect;
  const assistanceUnlocked =
    state.failedReturns >= KNOWLEDGE_RULES.assistedFailures &&
    session.reviewIndex === KNOWLEDGE_RULES.reviewCount;
  if (assisted ? !assistanceUnlocked || passed : !passed) return false;
  session.assisted = assisted;
  session.status = 'returning';
  return true;
}
