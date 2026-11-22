import { ERarityKind, type IItemRarity } from '../abstraction/hexobject-abstraction';

export const DEFAULT_RARITY: IItemRarity = { kind: ERarityKind.IDOL, boss: false };

export type TRarityTone =
  'gloom' | 'gloom-boss' | 'idol' | 'idol-boss' | 'spark' | 'spark-boss' | 'alien';

export const RARITY_TONES: readonly TRarityTone[] = [
  'gloom',
  'gloom-boss',
  'idol',
  'idol-boss',
  'spark',
  'spark-boss',
  'alien',
];

export function rarityTone(rarity: IItemRarity): TRarityTone {
  if (rarity.kind === ERarityKind.ALIEN) return 'alien';

  return rarity.boss ? `${rarity.kind}-boss` : rarity.kind;
}

export interface RarityCarrier {
  rarity: ERarityKind;
  origin: 'base' | 'unique';
}

export function tokenRarity(token: RarityCarrier): IItemRarity {
  return { kind: token.rarity, boss: token.origin === 'unique' };
}
