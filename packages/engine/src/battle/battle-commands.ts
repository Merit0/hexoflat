import { z } from 'zod';
import { axialSchema, battleCreatureSchema, battleHandSchema } from './battle-state';

export const battleActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place-shield'), hex: axialSchema }),
  z.object({ kind: z.literal('remove-shield'), hex: axialSchema }),
  z.object({ kind: z.literal('confirm-block') }),
  z.object({ kind: z.literal('take-hit') }),
  z.object({ kind: z.literal('start-dodge') }),
  z.object({ kind: z.literal('push'), targetId: z.string().min(1) }),
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

const heroId = z.string().min(1);
const atMs = z.number().int().min(0);

export const BattleCommandSchema = z.object({
  type: z.literal('BATTLE'),
  payload: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('hero'), heroId, atMs, action: battleActionSchema }),
    z.object({ kind: z.literal('run-enemy-turn'), atMs }),
    z.object({
      kind: z.literal('start'),
      heroId,
      atMs,
      heroes: z.array(battleCreatureSchema).min(1),
    }),
    z.object({ kind: z.literal('close'), heroId, atMs }),
  ]),
});
export type BattleCommand = z.infer<typeof BattleCommandSchema>;

type BattlePayload = BattleCommand['payload'];
export type FightPayload = Extract<BattlePayload, { kind: 'hero' | 'run-enemy-turn' }>;
export type SquadLifecyclePayload = Exclude<BattlePayload, FightPayload>;
export type FightCommand = { type: 'BATTLE'; payload: FightPayload };
export type SquadLifecycleCommand = { type: 'BATTLE'; payload: SquadLifecyclePayload };

export function isFightCommand(command: BattleCommand): command is FightCommand {
  return command.payload.kind === 'hero' || command.payload.kind === 'run-enemy-turn';
}

export function isSquadLifecycleCommand(command: BattleCommand): command is SquadLifecycleCommand {
  return !isFightCommand(command);
}
