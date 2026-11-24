import { describe, expect, it } from 'vitest';
import { EQUIP_SLOTS } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { LIGHT_NAMES } from '@hexoflat/engine/content/token-type-rules';
import { LIGHT_NAME_COLOR, LIGHT_NAME_FRAME_URLS } from '@/render/light';
import { EQUIP_SLOT_ICON, ICON_PATHS, ITEM_ICON_BY_KEY } from './item-icons';

describe('item icon set', () => {
  it('has a colour and a frame for every tokenType', () => {
    for (const tokenType of LIGHT_NAMES) {
      expect(LIGHT_NAME_COLOR[tokenType]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(LIGHT_NAME_FRAME_URLS[tokenType]).toBeTruthy();
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
