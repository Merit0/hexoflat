import { ERarityKind, type IItemRarity } from '../abstraction/hexobject-abstraction';

export const DEFAULT_RARITY: IItemRarity = { kind: ERarityKind.IDOL, boss: false };

export type TRarityTone =
  'gloom' | 'gloom-boss' | 'idol' | 'idol-boss' | 'spark' | 'spark-boss' | 'god-executor';

export const RARITY_TONES: readonly TRarityTone[] = [
  'gloom',
  'gloom-boss',
  'idol',
  'idol-boss',
  'spark',
  'spark-boss',
  'god-executor',
];

export function rarityTone(rarity: IItemRarity): TRarityTone {
  if (rarity.kind === ERarityKind.GOD_EXECUTOR) return 'god-executor';

  return rarity.boss ? `${rarity.kind}-boss` : rarity.kind;
}
