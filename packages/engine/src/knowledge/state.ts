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
export const sessionSchema = hallSessionSchema;

function dropRetiredSessions(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const session = record.session as { mode?: unknown } | null | undefined;
  const isRetired =
    !!session &&
    typeof session === 'object' &&
    (session.mode === 'return' || ('questions' in session && session.mode === 'hall'));
  return isRetired ? { ...record, session: null } : record;
}

const LEGACY_SKILL_IDS: Record<string, string> = { attack: 'b_strike', defense: 'b_guard' };

function migrateLegacySkills(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const skills = record.skills;
  if (!skills || typeof skills !== 'object') return record;
  const migrated: Record<string, number> = {};
  for (const [key, rank] of Object.entries(skills as Record<string, unknown>)) {
    const id = LEGACY_SKILL_IDS[key] ?? key;
    if (!skillIdSchema.safeParse(id).success || typeof rank !== 'number') continue;
    migrated[id] = Math.max(migrated[id] ?? 0, rank);
  }
  return { ...record, skills: migrated };
}

const knowledgeStateObjectSchema = z
  .object({
    version: z.literal(1),
    heroId: z.string(),
    revision: z.number().int().nonnegative(),
    current: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
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
  (value) => migrateLegacySkills(dropRetiredSessions(value)),
  knowledgeStateObjectSchema,
);
export type KnowledgeState = z.infer<typeof knowledgeStateObjectSchema>;
export type HallSession = z.infer<typeof hallSessionSchema>;

export function createKnowledgeState(heroId: string): KnowledgeState {
  return {
    version: 1,
    heroId,
    revision: 0,
    current: KNOWLEDGE_RULES.startingWill,
    capacity: effectiveWillCapacity(KNOWLEDGE_RULES.capacity),
    sequence: 0,
    session: null,
    lastStep: null,
    history: {},
    skills: {},
  };
}
