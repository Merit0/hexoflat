import { z } from 'zod';
import { axialSchema, battleHandSchema } from './battle-state';

export const battleActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place-shield'), hex: axialSchema }),
  z.object({ kind: z.literal('remove-shield'), hex: axialSchema }),
  z.object({ kind: z.literal('confirm-block') }),
  z.object({ kind: z.literal('take-hit') }),
  z.object({ kind: z.literal('start-dodge') }),
  z.object({ kind: z.literal('push'), targetId: z.string().min(1) }),
  z.object({ kind: z.literal('pull'), targetId: z.string().min(1) }),
  z.object({ kind: z.literal('answer-task'), option: z.number().int().min(0).max(3) }),
  z.object({ kind: z.literal('task-timeout') }),
  z.object({ kind: z.literal('move'), hex: axialSchema }),
  z.object({ kind: z.literal('undo-step') }),
  z.object({ kind: z.literal('strike'), targetId: z.string().min(1), hand: battleHandSchema }),
  z.object({
    kind: z.literal('swap-item'),
    hand: battleHandSchema,
    bagIndex: z.number().int().min(0),
  }),
  z.object({ kind: z.literal('use-item'), hand: battleHandSchema }),
  z.object({ kind: z.literal('end-turn') }),
]);
export type BattleAction = z.infer<typeof battleActionSchema>;

export const BattleCommandSchema = z.object({
  type: z.literal('BATTLE'),
  payload: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('hero'),
      heroId: z.string().min(1),
      atMs: z.number().int().min(0),
      action: battleActionSchema,
    }),
    z.object({ kind: z.literal('run-enemy-turn'), atMs: z.number().int().min(0) }),
  ]),
});
export type BattleCommand = z.infer<typeof BattleCommandSchema>;
