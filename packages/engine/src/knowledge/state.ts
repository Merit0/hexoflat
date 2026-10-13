import { z } from 'zod';
import { KNOWLEDGE_RULES, effectiveWillCapacity } from './math';

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
export const sessionSchema = z
  .object({
    id: z.string(),
    mode: z.enum(['hall', 'return']),
    seed: z.string(),
    questions: z.array(questionSchema).length(20),
    answers: z.array(z.number().int()).max(20),
    index: z.number().int().min(0).max(19),
    status: z.enum(['question', 'feedback', 'result', 'claimed', 'returning', 'returned']),
    originMapId: z.string(),
    awarded: z.number().int().nonnegative().default(0),
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
export const knowledgeStateSchema = z
  .object({
    version: z.literal(1),
    heroId: z.string(),
    revision: z.number().int().nonnegative(),
    current: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
    failedReturns: z.number().int().nonnegative(),
    session: sessionSchema.nullable(),
    pausedHall: sessionSchema.nullable().default(null),
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
  })
  .refine((s) => s.current <= s.capacity);
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;
export type KnowledgeSession = z.infer<typeof sessionSchema>;

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
    pausedHall: null,
    lastStep: null,
    history: {},
  };
}

export function correctCount(session: KnowledgeSession): number {
  return session.answers.filter((answer, index) => answer === session.questions[index].answer)
    .length;
}

export function reviewQuestions(session: KnowledgeSession) {
  const missed = session.questions.filter((q, i) => q.answer !== session.answers[i]);
  return Array.from({ length: KNOWLEDGE_RULES.reviewCount }, (_, i) => missed[i % missed.length]);
}
