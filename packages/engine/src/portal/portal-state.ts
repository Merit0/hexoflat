import { z } from 'zod';
import { LOCATION_KEYS } from '../registry/location-key';
import type { HeroState } from '../hero-movement/hero-state';

const coordinatesSchema = z.object({ columnIndex: z.number(), rowIndex: z.number() });

export const portalLinkSchema = z.object({
  originLocationKey: z.enum(LOCATION_KEYS),
  originMapId: z.string(),
  originHex: coordinatesSchema,
  campHex: coordinatesSchema.nullable(),
});
export type PortalLink = z.infer<typeof portalLinkSchema>;

export type PortalCloseReason = 'RETURNED' | 'OTHER_GATE' | 'DEATH';

export function heroPortal(hero: HeroState): PortalLink | null {
  return hero.portal ?? null;
}

export function normalizeHeroPortal(hero: HeroState): HeroState {
  return hero.portal ? { ...hero, portal: portalLinkSchema.parse(hero.portal) } : hero;
}
