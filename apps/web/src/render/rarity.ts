import {
  EEquipmentRarity,
  EHexobjectGroup,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';

export const RARITY_FRAME_URLS: Record<EEquipmentRarity, string> = {
  [EEquipmentRarity.BASIC]: '/hex-assets/hex-frames/gray-light.png',
  [EEquipmentRarity.COMMON]: '/hex-assets/hex-frames/blue-light.png',
  [EEquipmentRarity.RARE]: '/hex-assets/hex-frames/yellow-light.png',
  [EEquipmentRarity.LEGEND]: '/hex-assets/hex-frames/orange-light.png',
  [EEquipmentRarity.MYTHIC]: '/hex-assets/hex-frames/violet-light.png',
};

interface IRaritySource {
  groupType: EHexobjectGroup;
  tool?: { rarity?: EEquipmentRarity };
  equipment?: { rarity?: EEquipmentRarity };
}

export function getObjectRarity(obj: IRaritySource): EEquipmentRarity | null {
  if (obj.groupType === EHexobjectGroup.TOOL) return obj.tool?.rarity ?? EEquipmentRarity.COMMON;
  if (obj.groupType === EHexobjectGroup.EQUIPMENT) {
    return obj.equipment?.rarity ?? EEquipmentRarity.COMMON;
  }

  return null;
}
