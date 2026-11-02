import { describe, expect, it } from 'vitest';
import { BATTLE_ITEMS, battleItem, battleItemDefSchema } from './battle-catalogue';

describe('usable battle items carry their own use price', () => {
  it('gives every healing item a usePrice and copies it onto the item', () => {
    for (const def of Object.values(BATTLE_ITEMS).filter((item) => item.heal)) {
      expect(def.usePrice).toBeGreaterThan(0);
      expect(battleItem(def.id).usePrice).toBe(def.usePrice);
    }
  });

  it('refuses a usable item without a use price', () => {
    const def = {
      id: 'broken-tonic',
      heal: 1,
      title: 'content.battle.broken-tonic.title',
      tableRule: 'content.battle.broken-tonic.tableRule',
    };
    expect(battleItemDefSchema.safeParse(def).success).toBe(false);
    expect(battleItemDefSchema.safeParse({ ...def, usePrice: 2 }).success).toBe(true);
  });
});
