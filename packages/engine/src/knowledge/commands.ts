import { z } from 'zod';
import type { WillZone } from './will-zone';

export const KnowledgeCommandSchema = z.object({
  type: z.literal('KNOWLEDGE'),
  payload: z.object({
    heroId: z.string(),
    revision: z.number().int().nonnegative(),
    action: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('start'),
        mode: z.enum(['hall', 'return']),
        seed: z.string().min(1),
      }),
      z.object({
        kind: z.literal('answer'),
        sessionId: z.string(),
        questionId: z.string(),
        answer: z.number().int(),
        elapsedMs: z.number().int().min(0).max(3_600_000).optional(),
      }),
      z.object({ kind: z.literal('next'), sessionId: z.string(), questionId: z.string() }),
      z.object({ kind: z.literal('return'), sessionId: z.string(), assisted: z.boolean() }),
      z.object({ kind: z.literal('returned'), sessionId: z.string() }),
      z.object({
        kind: z.literal('review'),
        sessionId: z.string(),
        index: z.number().int(),
        answer: z.number().int(),
      }),
      z.object({
        kind: z.literal('step'),
        target: z.object({ columnIndex: z.number().int(), rowIndex: z.number().int() }).optional(),
      }),
      z.object({ kind: z.literal('open') }),
    ]),
  }),
});
export type KnowledgeCommand = z.infer<typeof KnowledgeCommandSchema>;
export type KnowledgeAction = KnowledgeCommand['payload']['action'];

/** Supplied by the state owner, never taken from a player's command payload. */
export interface KnowledgeContext {
  locationKey: string;
  mapId: string;
  willZone: WillZone;
  combatActive: boolean;
  moving: boolean;
  atBook: boolean;
  coordinates?: { columnIndex: number; rowIndex: number };
}
