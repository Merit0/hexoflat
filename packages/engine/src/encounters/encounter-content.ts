import { z } from 'zod';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { hexobjectKeySchema } from '../content/content-schema';
import { BATTLE_CREATURES } from '../battle/battle-catalogue';

const i18nKey = z.string().regex(/^content\.encounter\.[a-z0-9-]+\.[a-zA-Z]+$/);

const memberSchema = z
  .string()
  .refine((kind) => !!BATTLE_CREATURES[kind] && BATTLE_CREATURES[kind].behaviour !== 'hero', {
    message: 'encounter member must be a battle enemy kind',
  });

export const encounterDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  members: z.array(memberSchema).min(1),
  sentry: z.boolean(),
  boss: z.boolean(),
  loot: z.array(hexobjectKeySchema).min(1),
  battlefieldBiome: z.enum(['crypt']),
  title: i18nKey,
  tableRule: i18nKey,
});
export type EncounterDef = z.infer<typeof encounterDefSchema>;

export const encounterRulesSchema = z.object({
  attackWill: z.number().int().min(0),
  scoutWill: z.number().int().min(0),
  sneakMs: z.number().int().positive(),
  threat: z.object({ easyMax: z.number().positive(), riskyMax: z.number().positive() }),
  unarmedPower: z.number().int().positive(),
});
export type EncounterRules = z.infer<typeof encounterRulesSchema>;

export const ENCOUNTER_RULES: EncounterRules = encounterRulesSchema.parse({
  attackWill: 2,
  scoutWill: 1,
  sneakMs: 5000,
  threat: { easyMax: 0.6, riskyMax: 1.3 },
  unarmedPower: 1,
});

function texts(id: string) {
  return { title: `content.encounter.${id}.title`, tableRule: `content.encounter.${id}.tableRule` };
}

export const ENCOUNTERS: Record<string, EncounterDef> = Object.fromEntries(
  [
    {
      id: 'lone-skeleton',
      members: ['skeleton-warrior'],
      sentry: false,
      boss: false,
      loot: [HEXOBJECT_KEYS.BONE_CHARM],
      battlefieldBiome: 'crypt',
      ...texts('lone-skeleton'),
    },
    {
      id: 'skeleton-pack',
      members: ['skeleton-warrior', 'skeleton-warrior'],
      sentry: false,
      boss: false,
      loot: [HEXOBJECT_KEYS.SWORD],
      battlefieldBiome: 'crypt',
      ...texts('skeleton-pack'),
    },
    {
      id: 'archer-watch',
      members: ['skeleton-archer', 'skeleton-archer'],
      sentry: true,
      boss: false,
      loot: [HEXOBJECT_KEYS.HEALTH_BOTTLE],
      battlefieldBiome: 'crypt',
      ...texts('archer-watch'),
    },
    {
      id: 'bone-court',
      members: ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'],
      sentry: false,
      boss: true,
      loot: [HEXOBJECT_KEYS.CROWN_SHARD],
      battlefieldBiome: 'crypt',
      ...texts('bone-court'),
    },
  ].map((def) => [def.id, encounterDefSchema.parse(def)]),
);

export function encounterDef(contentId: string): EncounterDef {
  const def = ENCOUNTERS[contentId];
  if (!def) throw new Error(`Unknown encounter: ${contentId}`);
  return def;
}
