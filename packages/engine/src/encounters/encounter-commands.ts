import { z } from 'zod';
import { battleCreatureSchema } from '../battle/battle-state';

const coordinatesSchema = z.object({
  columnIndex: z.number().int(),
  rowIndex: z.number().int(),
});

const target = { encounterId: z.string().min(1) };

export const encounterActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attack'), ...target }),
  z.object({ kind: z.literal('scout'), ...target }),
  z.object({ kind: z.literal('start-sneak'), ...target }),
  z.object({
    kind: z.literal('answer-sneak'),
    ...target,
    option: z.number().int().min(0).max(3),
  }),
  z.object({ kind: z.literal('sneak-timeout'), ...target }),
  z.object({ kind: z.literal('pickup-loot'), ...target }),
  z.object({ kind: z.literal('step-ended') }),
  z.object({ kind: z.literal('start-battle'), heroes: z.array(battleCreatureSchema).min(1) }),
  z.object({ kind: z.literal('close-battle') }),
]);
export type EncounterAction = z.infer<typeof encounterActionSchema>;

export const EncounterCommandSchema = z.object({
  type: z.literal('ENCOUNTER'),
  payload: z.object({
    heroId: z.string().min(1),
    atMs: z.number().int().min(0),
    action: encounterActionSchema,
  }),
});
export type EncounterCommand = z.infer<typeof EncounterCommandSchema>;

export const engagementSchema = z.object({
  encounterId: z.string().min(1),
  ambush: z.boolean(),
  heroAt: coordinatesSchema,
  heroIds: z.array(z.string().min(1)).min(1),
  startItems: z.record(z.string(), z.array(z.string())).default({}),
});
export type Engagement = z.infer<typeof engagementSchema>;

export const ENCOUNTER_REJECTIONS = [
  'UNKNOWN_ENCOUNTER',
  'NO_HERO',
  'NOT_ADJACENT',
  'ALREADY_SCOUTED',
  'INSUFFICIENT_WILL',
  'NO_WILL_STATE',
  'ENCOUNTER_DEFEATED',
  'NO_LOOT',
  'NO_SNEAK',
  'SNEAK_OPEN',
  'BATTLE_OPEN',
  'NO_ENGAGEMENT',
  'BATTLE_NOT_ENDED',
] as const;
export type EncounterRejection = (typeof ENCOUNTER_REJECTIONS)[number];
