import { ERarityKind, type IItemRarity } from '../abstraction/hexobject-abstraction';
import {
  DIMENSION_TIERS,
  tiersOfTokenType,
  tokenTypeAllowsTier,
  type TierLight,
  type TTierToneName,
  type TTokenTier,
} from '../dimensions/dimensions';
import type { TLightTone } from '../tokens/light-tone';

export const DEFAULT_RARITY: IItemRarity = { kind: ERarityKind.IDOL, boss: false };

export type TRarityTone = TTierToneName;

function toneName(tokenType: ERarityKind, tier: TTokenTier): TRarityTone {
  const named = tier === 'unique' && tokenTypeAllowsTier(tokenType, 'base');
  return (named ? `${tokenType}-boss` : tokenType) as TRarityTone;
}

export const RARITY_TONES: readonly TRarityTone[] = Object.freeze(
  DIMENSION_TIERS.map((view) => toneName(view.tokenType, view.tier)),
);

export const RARITY_TONE_LIGHTS: Readonly<Record<TRarityTone, TierLight>> = Object.freeze(
  Object.fromEntries(
    DIMENSION_TIERS.map((view) => [toneName(view.tokenType, view.tier), view.light]),
  ) as Record<TRarityTone, TierLight>,
);

const RARITY_TONE_BY_LIGHT_TONE: Readonly<Record<TLightTone, TRarityTone>> = Object.freeze(
  Object.fromEntries(
    DIMENSION_TIERS.map((view) => [
      `${view.tokenType}-${view.tier}`,
      toneName(view.tokenType, view.tier),
    ]),
  ) as Record<TLightTone, TRarityTone>,
);

export function rarityToneOfLightTone(tone: TLightTone): TRarityTone {
  return RARITY_TONE_BY_LIGHT_TONE[tone];
}

export function rarityTone(rarity: IItemRarity): TRarityTone {
  const wanted: TTokenTier = rarity.boss ? 'unique' : 'base';
  const tier = tokenTypeAllowsTier(rarity.kind, wanted) ? wanted : tiersOfTokenType(rarity.kind)[0];
  return toneName(rarity.kind, tier);
}

export interface RarityCarrier {
  rarity: ERarityKind;
  origin: 'base' | 'unique';
}

export function tokenRarity(token: RarityCarrier): IItemRarity {
  return { kind: token.rarity, boss: token.origin === 'unique' };
}
