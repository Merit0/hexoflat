import { z } from 'zod';
import { KNOWLEDGE_RULES, effectiveWillCapacity } from './math';
import { skillIdSchema } from '../skills/skill-content';

const questionSchema = z
  .object({
    id: z.string(),
    operation: z.enum(['multiply', 'divide']),
    lhs: z.number().int().positive(),
    rhs: z.number().int().min(2).max(9),
    answer: z.number().int().positive(),
    options: z.array(z.number().int().positive()).length(4),
    factKey: z.string(),
  })
  .refine((q) => {
    const factor = q.operation === 'multiply' ? q.lhs : q.answer;
    return (
      factor >= 2 &&
      factor <= 9 &&
      new Set(q.options).size === 4 &&
      q.options.includes(q.answer) &&
      q.answer === (q.operation === 'multiply' ? q.lhs * q.rhs : q.lhs / q.rhs)
    );
  });
export const returnSessionSchema = z
  .object({
    id: z.string(),
    mode: z.literal('return'),
    seed: z.string(),
    questions: z.array(questionSchema).length(20),
    answers: z.array(z.number().int()).max(20),
    index: z.number().int().min(0).max(19),
    status: z.enum(['question', 'feedback', 'result', 'returning', 'returned']),
    originMapId: z.string(),
    reviewIndex: z.number().int().min(0).max(10).default(0),
    assisted: z.boolean().default(false),
  })
  .refine((s) => {
    const expected = s.status === 'question' ? s.index : s.status === 'feedback' ? s.index + 1 : 20;
    return (
      s.answers.length === expected &&
      new Set(s.questions.map((q) => q.id)).size === 20 &&
      new Set(s.questions.map((q) => q.factKey)).size === 20 &&
      s.questions.filter((q) => q.operation === 'multiply').length === 10 &&
      s.answers.every((answer, i) => s.questions[i].options.includes(answer))
    );
  });
export const hallSessionSchema = z
  .object({
    id: z.string(),
    mode: z.literal('hall'),
    seed: z.string(),
    originMapId: z.string(),
    status: z.enum(['question', 'feedback', 'done']),
    index: z.number().int().nonnegative(),
    question: questionSchema,
    answer: z.number().int().nullable(),
    correct: z.number().int().nonnegative(),
    earned: z.number().int().nonnegative(),
    lastAward: z.number().int().nonnegative(),
    recent: z.array(z.string()).max(16),
  })
  .refine(
    (s) => s.status !== 'feedback' || (s.answer !== null && s.question.options.includes(s.answer)),
  );
export const sessionSchema = z.discriminatedUnion('mode', [returnSessionSchema, hallSessionSchema]);

function dropLegacyHallSessions(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const session = record.session as { mode?: unknown } | null | undefined;
  const isLegacyHall =
    !!session && typeof session === 'object' && 'questions' in session && session.mode === 'hall';
  return isLegacyHall ? { ...record, session: null } : record;
}

const knowledgeStateObjectSchema = z
  .object({
    version: z.literal(1),
    heroId: z.string(),
    revision: z.number().int().nonnegative(),
    current: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
    failedReturns: z.number().int().nonnegative(),
    session: sessionSchema.nullable(),
    lastStep: z
      .object({
        mapId: z.string(),
        columnIndex: z.number().int(),
        rowIndex: z.number().int(),
        revision: z.number().int(),
      })
      .nullable()
      .default(null),
    history: z.record(z.string(), z.array(z.boolean()).max(10)),
    skills: z.partialRecord(skillIdSchema, z.number().int().min(0)).default({}),
  })
  .refine((s) => s.current <= s.capacity);
export const knowledgeStateSchema = z.preprocess(
  dropLegacyHallSessions,
  knowledgeStateObjectSchema,
);
export type KnowledgeState = z.infer<typeof knowledgeStateObjectSchema>;
export type ReturnSession = z.infer<typeof returnSessionSchema>;
export type HallSession = z.infer<typeof hallSessionSchema>;

export function createKnowledgeState(heroId: string): KnowledgeState {
  return {
    version: 1,
    heroId,
    revision: 0,
    current: KNOWLEDGE_RULES.startingWill,
    capacity: effectiveWillCapacity(KNOWLEDGE_RULES.capacity),
    sequence: 0,
    failedReturns: 0,
    session: null,
    lastStep: null,
    history: {},
    skills: {},
  };
}

export function correctCount(session: ReturnSession): number {
  return session.answers.filter((answer, index) => answer === session.questions[index].answer)
    .length;
}

export function reviewQuestions(session: ReturnSession) {
  const missed = session.questions.filter((q, i) => q.answer !== session.answers[i]);
  return Array.from({ length: KNOWLEDGE_RULES.reviewCount }, (_, i) => missed[i % missed.length]);
}
