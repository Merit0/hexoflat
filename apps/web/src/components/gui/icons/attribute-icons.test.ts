import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '@hexoflat/engine';
import { ICON_PATHS } from './item-icons';

describe('EA-16b: equipment attribute icons', () => {
  it.each(EQUIPMENT_ATTRIBUTES.map((attribute) => [attribute.key, attribute.display.icon]))(
    'the icon of %s (%s) is in the item icon set',
    (_key, icon) => {
      expect(Object.keys(ICON_PATHS)).toContain(icon);
    },
  );
});
