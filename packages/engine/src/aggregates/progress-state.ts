import { z } from 'zod';
import { createKnowledgeState, knowledgeStateSchema } from '../knowledge/state';
import { LOCATION_KEYS } from '../registry/location-key';

export const CAMP_FIRST_CHEST_REWARD = 'camp-first-chest';

export const presenceSchema = z
  .object({
    locationKey: z.enum(LOCATION_KEYS),
    mapId: z.string().min(1).max(80),
    coordinates: z.object({
      columnIndex: z.number().int().min(0).max(255),
      rowIndex: z.number().int().min(0).max(255),
    }),
  })
  .strict();
export type Presence = z.infer<typeof presenceSchema>;

/**
 * Everything a hero earns by playing that is not an item: Will and skills (the knowledge state),
 * the steps he walked, the one-time rewards he took, and where he stands (so a step can be
 * checked against the last position the server saw).
 */
export const progressStateSchema = z
  .object({
    claimedRewards: z.array(z.string().min(1)).max(1000),
    knowledge: knowledgeStateSchema,
    presence: presenceSchema.nullable(),
    steps: z.number().int().nonnegative(),
  })
  .strict();
export type ProgressState = z.infer<typeof progressStateSchema>;

export function emptyProgressState(heroId: string): ProgressState {
  return {
    claimedRewards: [],
    knowledge: createKnowledgeState(heroId),
    presence: null,
    steps: 0,
  };
}
