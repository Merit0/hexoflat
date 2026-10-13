import type { KnowledgeAction, KnowledgeCommand, KnowledgeContext } from './commands';
import { correctCount, reviewQuestions, type KnowledgeState } from './state';
import { generateQuestions, KNOWLEDGE_RULES, reward, stepCost } from './math';
import { willZoneCharges } from './will-zone';
import { grantWill, spendWill } from './will';
import type { DomainEvent } from '../commands/types';

function available(mode: 'hall' | 'return', state: KnowledgeState, ctx: KnowledgeContext): boolean {
  if (ctx.combatActive || ctx.moving) return false;
  return mode === 'hall'
    ? !willZoneCharges(ctx) && ctx.atBook
    : willZoneCharges(ctx) && state.current < stepCost(ctx, ctx.coordinates);
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
    !['claimed', 'returned'].includes(previous.status) &&
    !(
      previous.mode === 'return' &&
      previous.status === 'result' &&
      correctCount(previous) < KNOWLEDGE_RULES.returnMinCorrect
    )
  )
    return false;
  if (action.mode === 'return' && previous?.mode === 'hall' && previous.status !== 'claimed')
    state.pausedHall = previous;
  state.sequence++;
  const id = `${state.heroId}:${state.sequence}`;
  state.session = {
    id,
    mode: action.mode,
    seed: action.seed,
    questions: generateQuestions(action.seed, action.mode === 'hall' ? state.history : {}),
    answers: [],
    index: 0,
    status: 'question',
    originMapId: ctx.mapId,
    awarded: 0,
    reviewIndex: 0,
    assisted: false,
  };
  return true;
}

function finishAnswer(state: KnowledgeState): void {
  const session = state.session!;
  if (session.index < 19) {
    session.index++;
    session.status = 'question';
    return;
  }
  session.status = 'result';
  for (const [i, q] of session.questions.entries()) {
    state.history[q.factKey] = [
      ...(state.history[q.factKey] ?? []),
      q.answer === session.answers[i],
    ].slice(-10);
  }
  if (session.mode === 'return' && correctCount(session) < KNOWLEDGE_RULES.returnMinCorrect)
    state.failedReturns++;
}

function transition(
  state: KnowledgeState,
  action: KnowledgeAction,
  ctx: KnowledgeContext,
  willEvents: DomainEvent[],
): boolean {
  if (action.kind === 'open') {
    if (!available('hall', state, ctx)) return false;
    if (state.session?.mode === 'return' && state.session.status !== 'returning') {
      state.session = state.pausedHall;
      state.pausedHall = null;
    }
    return true;
  }
  if (action.kind === 'step') {
    if (!willZoneCharges(ctx)) return true;
    const ref = action.target
      ? `${action.target.columnIndex}:${action.target.rowIndex}`
      : ctx.mapId;
    const spent = spendWill(state, stepCost(ctx, action.target), 'step', ref);
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
    if (session.status !== 'returning' || ctx.locationKey !== 'camping') return false;
    session.status = 'returned';
    state.failedReturns = 0;
    return true;
  }
  if (!available(session.mode, state, ctx) || ctx.mapId !== session.originMapId) return false;
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
      finishAnswer(state);
      return true;
    case 'claim':
      if (session.mode !== 'hall' || session.status !== 'result' || session.answers.length !== 20)
        return false;
      session.awarded = reward(correctCount(session), state.current, state.capacity);
      willEvents.push(...grantWill(state, session.awarded, { kind: 'hall', ref: session.id }));
      session.status = 'claimed';
      return true;
    case 'review': {
      if (
        session.mode !== 'return' ||
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
  const session = state.session!;
  if (session.mode !== 'return' || session.status !== 'result' || session.answers.length !== 20)
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
