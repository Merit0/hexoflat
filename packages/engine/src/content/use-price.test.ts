import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import { BATTLE_ITEMS } from '../battle/battle-catalogue';
import { getPortalBaseCost } from '../skills/skill-rules';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { CONTENT } from './content-map';
import { usePriceOf } from './content-accessors';

describe('usePrice: every usable item states what using it costs', () => {
  it('has a price on every loot item that has a USE action', () => {
    const missing = (Object.keys(CONTENT) as THexobjectKey[]).filter((key) => {
      const content = CONTENT[key];
      return (
        content.groupType === EHexobjectGroup.LOOT &&
        content.actions?.[EHexActionType.USE] &&
        usePriceOf(key) === null
      );
    });
    expect(missing).toEqual([]);
  });

  it('gives the battle potion the same price as the potion on the map', () => {
    expect(BATTLE_ITEMS['health-potion'].usePrice).toBe(usePriceOf(HEXOBJECT_KEYS.HEALTH_BOTTLE));
  });

  it('keeps the scroll base price equal to the first rank of its skill', () => {
    expect(usePriceOf(HEXOBJECT_KEYS.RETURN_SCROLL)).toBe(getPortalBaseCost());
  });
});
