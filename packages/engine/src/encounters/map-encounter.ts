import { z } from 'zod';

const coordinatesSchema = z.object({
  columnIndex: z.number().int(),
  rowIndex: z.number().int(),
});

export const sneakTaskSchema = z.object({
  id: z.string().min(1),
  heroId: z.string().min(1),
  question: z.object({
    operation: z.enum(['multiply', 'divide']),
    lhs: z.number().int(),
    rhs: z.number().int(),
  }),
  options: z.array(z.number().int()).length(4),
  answer: z.number().int(),
  issuedAtMs: z.number().int().min(0),
  deadlineMs: z.number().int().min(0),
  from: coordinatesSchema,
});
export type SneakTask = z.infer<typeof sneakTaskSchema>;

export const ENCOUNTER_STATUSES = ['active', 'loot', 'looted'] as const;

export const mapEncounterSchema = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  scouted: z.boolean().default(false),
  status: z.enum(ENCOUNTER_STATUSES).default('active'),
  attempts: z.number().int().min(0).default(0),
  taskSeq: z.number().int().min(0).default(0),
  sneak: sneakTaskSchema.optional(),
});
export type MapEncounter = z.infer<typeof mapEncounterSchema>;

export function blocksTile(encounter: MapEncounter | undefined): boolean {
  return !!encounter && encounter.status !== 'looted';
}

export function encounterInstanceId(
  contentId: string,
  at: { columnIndex: number; rowIndex: number },
): string {
  return `${contentId}@${at.columnIndex}-${at.rowIndex}`;
}

export function newMapEncounter(
  contentId: string,
  at: { columnIndex: number; rowIndex: number },
): MapEncounter {
  return mapEncounterSchema.parse({ id: encounterInstanceId(contentId, at), contentId });
}

const LEGACY_ENEMY_ENCOUNTERS: Record<string, string> = { skeletor: 'lone-skeleton' };

export function legacyEnemyEncounter(hexobjectKey: string | undefined): string | null {
  return hexobjectKey ? (LEGACY_ENEMY_ENCOUNTERS[hexobjectKey] ?? null) : null;
}
