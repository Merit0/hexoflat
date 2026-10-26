import type { KnowledgeAction, KnowledgeCommand, KnowledgeContext } from './commands';
import type { HallSession, KnowledgeState } from './state';
import { generateHallQuestion, hallAward, KNOWLEDGE_RULES, stepCost } from './math';
import { willZoneCharges } from './will-zone';
import { grantWill, spendWill } from './will';
import type { DomainEvent } from '../commands/types';

function available(ctx: KnowledgeContext): boolean {
  return !ctx.combatActive && !ctx.moving && !willZoneCharges(ctx) && ctx.atBook;
}

function start(
  state: KnowledgeState,
  action: Extract<KnowledgeAction, { kind: 'start' }>,
  ctx: KnowledgeContext,
): boolean {
  if (!available(ctx) || state.current >= state.capacity) return false;
  if (state.session && state.session.status !== 'done') return false;
  state.sequence++;
  state.session = {
    id: `${state.heroId}:${state.sequence}`,
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

function transition(
  state: KnowledgeState,
  action: KnowledgeAction,
  ctx: KnowledgeContext,
  willEvents: DomainEvent[],
): boolean {
  if (action.kind === 'open') {
    if (!available(ctx)) return false;
    state.session = null;
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
  if (!available(ctx) || ctx.mapId !== session.originMapId) return false;
  if (action.kind === 'answer') return answerHall(state, session, action, willEvents);
  return action.kind === 'next' ? nextHall(state, session, action) : false;
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
