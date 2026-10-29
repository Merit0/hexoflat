import { z } from 'zod';

const coordinatesSchema = z.object({
  columnIndex: z.number().int(),
  rowIndex: z.number().int(),
});

function legacySquadId(encounterId: string): string {
  const match = /^(.+)@(-?\d+)-(-?\d+)$/.exec(encounterId);
  if (!match) return encounterId;
  const [, contentId, column, row] = match;
  return `${column}:${row}:${contentId}`;
}

function fromLegacyEngagement(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || 'squadId' in raw || !('encounterId' in raw)) return raw;
  const { encounterId, ...rest } = raw;
  return typeof encounterId === 'string' ? { ...rest, squadId: legacySquadId(encounterId) } : raw;
}

export const engagementSchema = z.preprocess(
  fromLegacyEngagement,
  z.object({
    squadId: z.string().min(1),
    ambush: z.boolean(),
    heroAt: coordinatesSchema,
    heroIds: z.array(z.string().min(1)).min(1),
    startItems: z.record(z.string(), z.array(z.string())).default({}),
  }),
);
export type Engagement = z.infer<typeof engagementSchema>;

export const SQUAD_REJECTIONS = [
  'UNKNOWN_SQUAD',
  'NO_HERO',
  'NOT_ADJACENT',
  'ALREADY_SCOUTED',
  'BATTLE_OPEN',
  'NO_ENGAGEMENT',
  'BATTLE_NOT_ENDED',
] as const;
export type SquadRejection = (typeof SQUAD_REJECTIONS)[number];
