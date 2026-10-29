import { z } from 'zod';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobject } from '../abstraction/hexobject-abstraction';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { isSquadKey } from '../content/squad-keys';
import { asSquad } from './squad-state';

export const squadInstanceSchema = z.object({
  scouted: z.boolean().optional(),
  attempts: z.number().int().min(0).optional(),
});
export type SquadInstance = z.infer<typeof squadInstanceSchema>;

const legacyEncounterSchema = squadInstanceSchema.extend({
  contentId: z.string().min(1),
  status: z.enum(['active', 'loot', 'looted']).default('active'),
});

const LEGACY_SQUAD_KEYS: Partial<Record<string, THexobjectKey>> = {
  [HEXOBJECT_KEYS.SKELETOR]: HEXOBJECT_KEYS.LONE_SKELETON,
};

export function legacySquadKey(hexobjectKey: string | undefined): THexobjectKey | null {
  return hexobjectKey ? (LEGACY_SQUAD_KEYS[hexobjectKey] ?? null) : null;
}

export function squadInstanceOf(saved: unknown): SquadInstance {
  const parsed = squadInstanceSchema.safeParse(saved);
  if (!parsed.success) return {};
  return Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
}

export function withSquadInstance(obj: THexobject, instance: SquadInstance): THexobject {
  const squad = asSquad(obj);
  if (squad) Object.assign(squad.creature, instance);
  return obj;
}

function squadPrototypeKey(contentId: string): THexobjectKey | null {
  return isSquadKey(contentId) ? contentId : null;
}

export function hexobjectFromLegacyEncounter(
  raw: unknown,
  at: IHexCoordinates,
): THexobject | null | undefined {
  if (!raw) return undefined;
  const parsed = legacyEncounterSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const { contentId, status, ...instance } = parsed.data;
  const key = squadPrototypeKey(contentId);
  if (!key || status === 'looted') return null;
  const squad = HexObjectFactory.create(key, at);
  if (status === 'loot') {
    const loot = asSquad(squad)?.creature.squad.loot;
    return loot ? HexObjectFactory.create(loot, at) : null;
  }
  return withSquadInstance(squad, squadInstanceOf(instance));
}
