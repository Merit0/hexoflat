import { ETokenType, type IItemTokenType } from '../abstraction/hexobject-abstraction';
import {
  DIMENSION_TIERS,
  tiersOfTokenType,
  tokenTypeAllowsTier,
  type TierLight,
  type TTierToneName,
  type TTokenTier,
} from '../dimensions/dimensions';
import type { TLightTone } from '../tokens/light-tone';

export const DEFAULT_ITEM_TOKEN_TYPE: IItemTokenType = { kind: ETokenType.IDOL, boss: false };

export type TLightName = TTierToneName;

function toneName(tokenType: ETokenType, tier: TTokenTier): TLightName {
  const named = tier === 'unique' && tokenTypeAllowsTier(tokenType, 'base');
  return (named ? `${tokenType}-boss` : tokenType) as TLightName;
}

export const LIGHT_NAMES: readonly TLightName[] = Object.freeze(
  DIMENSION_TIERS.map((view) => toneName(view.tokenType, view.tier)),
);

export const LIGHT_NAMES_BY_SORT_RANK: readonly TLightName[] = Object.freeze(
  [...DIMENSION_TIERS]
    .sort((a, b) => a.sortRank - b.sortRank)
    .map((view) => toneName(view.tokenType, view.tier)),
);

export const LIGHTS_BY_NAME: Readonly<Record<TLightName, TierLight>> = Object.freeze(
  Object.fromEntries(
    DIMENSION_TIERS.map((view) => [toneName(view.tokenType, view.tier), view.light]),
  ) as Record<TLightName, TierLight>,
);

const LIGHT_NAME_BY_TONE: Readonly<Record<TLightTone, TLightName>> = Object.freeze(
  Object.fromEntries(
    DIMENSION_TIERS.map((view) => [
      `${view.tokenType}-${view.tier}`,
      toneName(view.tokenType, view.tier),
    ]),
  ) as Record<TLightTone, TLightName>,
);

export function lightNameOfTone(tone: TLightTone): TLightName {
  return LIGHT_NAME_BY_TONE[tone];
}

export function lightNameOf(tokenType: IItemTokenType): TLightName {
  const wanted: TTokenTier = tokenType.boss ? 'unique' : 'base';
  const tier = tokenTypeAllowsTier(tokenType.kind, wanted)
    ? wanted
    : tiersOfTokenType(tokenType.kind)[0];
  return toneName(tokenType.kind, tier);
}

export interface TokenTypeCarrier {
  tokenType: ETokenType;
  tier: 'base' | 'unique';
}

export function itemTokenTypeOf(token: TokenTypeCarrier): IItemTokenType {
  return { kind: token.tokenType, boss: token.tier === 'unique' };
}
