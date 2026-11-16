export const HERO_ELSEWHERE = 'HERO_ELSEWHERE';

export function enterRefusal(
  presence: { locationKey: string } | null | undefined,
  locationKey: string,
): typeof HERO_ELSEWHERE | null {
  return presence && presence.locationKey !== locationKey ? HERO_ELSEWHERE : null;
}
