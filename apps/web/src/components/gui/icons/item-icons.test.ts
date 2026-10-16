import { describe, expect, it } from 'vitest';
import { EEquipmentRarity, EQUIP_SLOTS } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { EQUIP_SLOT_ICON, ICON_PATHS, ITEM_ICON_BY_KEY, RARITY_COLOR } from './item-icons';

describe('item icon set', () => {
  it('has a colour for every rarity', () => {
    for (const rarity of Object.values(EEquipmentRarity)) {
      expect(RARITY_COLOR[rarity]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('has an icon for every equip slot', () => {
    for (const slot of EQUIP_SLOTS) {
      expect(ICON_PATHS[EQUIP_SLOT_ICON[slot]]).toBeTruthy();
    }
  });

  it('only maps content keys to icons that exist', () => {
    for (const icon of Object.values(ITEM_ICON_BY_KEY)) {
      expect(ICON_PATHS[icon]).toBeTruthy();
    }
  });
});
