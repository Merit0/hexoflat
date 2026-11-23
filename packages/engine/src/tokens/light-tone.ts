import {
  DIMENSION_TIERS,
  tiersOfTokenType,
  tokenTypeAllowsTier,
  type TDimensionLightId,
  type TItemFamily,
  type TTierTone,
} from '../dimensions/dimensions';
import type { TTokenOrigin } from './token-keys';

export type TLightTone = TTierTone;

export const LIGHT_TONES: readonly TLightTone[] = Object.freeze(
  DIMENSION_TIERS.map((view) => `${view.tokenType}-${view.tier}` as TLightTone),
);

export function lightTone(origin: TTokenOrigin, rarity: TItemFamily): TLightTone {
  if (!tokenTypeAllowsTier(rarity, origin)) {
    throw new Error(`${rarity} tokens are ${tiersOfTokenType(rarity).join(' and ')} only`);
  }
  return `${rarity}-${origin}` as TLightTone;
}

export type TLightColor = TDimensionLightId;

export const LIGHT_COLOR_BY_TONE: Readonly<Record<TLightTone, TLightColor>> = Object.freeze(
  Object.fromEntries(
    DIMENSION_TIERS.map((view) => [`${view.tokenType}-${view.tier}`, view.light.id]),
  ) as Record<TLightTone, TLightColor>,
);

export function lightFrameFile(tone: TLightTone): string {
  return `${LIGHT_COLOR_BY_TONE[tone]}-light.png`;
}
