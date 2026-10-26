import { getPrototype } from '@hexoflat/engine';
import {
  EHexobjectGroup,
  type IItemRarity,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import {
  DEFAULT_RARITY,
  rarityTone,
  type TRarityTone,
} from '@hexoflat/engine/content/rarity-rules';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';

export const RARITY_FRAME_URLS: Record<TRarityTone, string> = {
  gloom: '/hex-assets/hex-frames/blue-light.png',
  'gloom-boss': '/hex-assets/hex-frames/violet-light.png',
  idol: '/hex-assets/hex-frames/gray-light.png',
  'idol-boss': '/hex-assets/hex-frames/green-light.png',
  spark: '/hex-assets/hex-frames/yellow-light.png',
  'spark-boss': '/hex-assets/hex-frames/orange-light.png',
  'god-executor': '/hex-assets/hex-frames/red-light.png',
};

export const RARITY_COLOR: Record<TRarityTone, string> = {
  gloom: '#3E8BFF',
  'gloom-boss': '#A855F7',
  idol: '#A9AEB4',
  'idol-boss': '#4FD27A',
  spark: '#F5D33B',
  'spark-boss': '#FF8A2A',
  'god-executor': '#FF3B3B',
};

interface IRaritySource {
  groupType: EHexobjectGroup;
  tool?: { rarity?: IItemRarity };
  equipment?: { rarity?: IItemRarity };
  loot?: { rarity?: IItemRarity };
}

export function getObjectRarity(obj: IRaritySource): IItemRarity | null {
  if (obj.groupType === EHexobjectGroup.TOOL) return obj.tool?.rarity ?? DEFAULT_RARITY;
  if (obj.groupType === EHexobjectGroup.EQUIPMENT) {
    return obj.equipment?.rarity ?? DEFAULT_RARITY;
  }
  if (obj.groupType === EHexobjectGroup.LOOT) return obj.loot?.rarity ?? null;

  return null;
}

export function getObjectRarityTone(obj: IRaritySource): TRarityTone | null {
  const rarity = getObjectRarity(obj);

  return rarity ? rarityTone(rarity) : null;
}

export function rarityFrameUrlForKey(key: THexobjectKey): string | null {
  const tone = getObjectRarityTone(getPrototype(key));
  return tone ? RARITY_FRAME_URLS[tone] : null;
}
