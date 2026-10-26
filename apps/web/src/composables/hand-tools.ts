import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';

export function toolKeyOfItem(itemKey: string | null | undefined): THeroToolKey | null {
  switch (itemKey) {
    case HEXOBJECT_KEYS.HAND:
      return HEXOBJECT_KEYS.HAND;
    case HEXOBJECT_KEYS.AXE:
      return HEXOBJECT_KEYS.AXE;
    case HEXOBJECT_KEYS.PICKAXE:
      return HEXOBJECT_KEYS.PICKAXE;
    case HEXOBJECT_KEYS.SWORD:
      return HEXOBJECT_KEYS.SWORD;
    case HEXOBJECT_KEYS.SHIELD:
      return HEXOBJECT_KEYS.SHIELD;
    case HEXOBJECT_KEYS.RETURN_SCROLL:
      return HEXOBJECT_KEYS.RETURN_SCROLL;
    default:
      return null;
  }
}
