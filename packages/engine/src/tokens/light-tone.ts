import {
  DIMENSION_TIERS,
  tiersOfTokenType,
  tokenTypeAllowsTier,
  type TDimensionLightId,
  type TTokenTier,
  type TTokenType,
  type TTierTone,
} from '../dimensions/dimensions';

export type TLightTone = TTierTone;

export const LIGHT_TONES: readonly TLightTone[] = Object.freeze(
  DIMENSION_TIERS.map((view) => `${view.tokenType}-${view.tier}` as TLightTone),
);

export function lightTone(tier: TTokenTier, tokenType: TTokenType): TLightTone {
  if (!tokenTypeAllowsTier(tokenType, tier)) {
    throw new Error(`${tokenType} tokens are ${tiersOfTokenType(tokenType).join(' and ')} only`);
  }
  return `${tokenType}-${tier}` as TLightTone;
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
