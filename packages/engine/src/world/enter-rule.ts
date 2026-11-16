export const HERO_ELSEWHERE = 'HERO_ELSEWHERE';

export const HOME_LOCATION = 'camping';

export function enterRefusal(
  presence: { locationKey: string } | null | undefined,
  locationKey: string,
): typeof HERO_ELSEWHERE | null {
  const held = presence ? presence.locationKey : HOME_LOCATION;
  return held === locationKey ? null : HERO_ELSEWHERE;
}
