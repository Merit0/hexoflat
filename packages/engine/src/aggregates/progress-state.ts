import { z } from 'zod';
import { createKnowledgeState, knowledgeStateSchema } from '../knowledge/state';
import { LOCATION_KEYS } from '../registry/location-key';
import { HERO_BASE_HEALTH } from '../models/hero-model';
import { portalLinkSchema } from '../portal/portal-state';
import { emptyListings, listingsSchema } from '../trade/listing-state';
import { tradersStateSchema } from '../trade/trade-state';

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

export const heroHealthSchema = z
  .object({
    current: z.number().min(0).max(10),
    bonus: z.number().min(0).max(10),
    debt: z.number().min(0).max(10),
  })
  .strict();

export const progressStateSchema = z
  .object({
    claimedRewards: z.array(z.string().min(1)).max(1000),
    knowledge: knowledgeStateSchema,
    presence: presenceSchema.nullable(),
    steps: z.number().int().nonnegative(),
    sealedUntil: z.partialRecord(z.enum(LOCATION_KEYS), z.number().int().nonnegative()),
    portal: portalLinkSchema.nullable(),
    health: heroHealthSchema,
    kills: z.number().int().nonnegative(),
    trips: z.number().int().nonnegative(),
    traders: tradersStateSchema,
    listings: listingsSchema,
  })
  .strict();
export type ProgressState = z.infer<typeof progressStateSchema>;

export function emptyProgressState(heroId: string): ProgressState {
  return {
    claimedRewards: [],
    knowledge: createKnowledgeState(heroId),
    presence: null,
    steps: 0,
    sealedUntil: {},
    portal: null,
    health: { current: HERO_BASE_HEALTH, bonus: 0, debt: 0 },
    kills: 0,
    trips: 0,
    traders: {},
    listings: emptyListings(),
  };
}
