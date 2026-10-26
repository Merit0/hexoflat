import { describe, expect, it } from 'vitest';
import { EEquipmentRarity, EHexobjectGroup } from '../../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../../registry/hexobjects-registry';
import { resolveItemTooltip } from './item-tooltip';

const ALL_KEYS = Object.values(HEXOBJECT_KEYS) as THexobjectKey[];
const RARITIES = Object.values(EEquipmentRarity);

describe('resolveItemTooltip', () => {
  it.each(ALL_KEYS)('builds a complete model for "%s"', (key) => {
    const view = resolveItemTooltip(key);
    expect(view.key).toBe(key);
    expect(view.title).not.toBe('');
    expect(RARITIES).toContain(view.rarity);
    expect(Object.values(EHexobjectGroup)).toContain(view.group);
    expect(view.footer.weightKg).toBeGreaterThanOrEqual(0);
    expect(view.equipped).toBe(false);
  });

  it('shows the damage range of a weapon', () => {
    const sword = resolveItemTooltip(HEXOBJECT_KEYS.SWORD);
    expect(sword.headline).toMatchObject({ kind: 'damage', min: 1, max: 1 });
    expect(sword.equipSlot).toBe('weapon');
    expect(sword.capabilities).toContain('attack');
  });

  it('shows the defense of a shield', () => {
    const shield = resolveItemTooltip(HEXOBJECT_KEYS.SHIELD);
    expect(shield.headline).toMatchObject({ kind: 'defense', min: 2.4, max: 2.4 });
    expect(shield.capabilities).toEqual(['block']);
    expect(shield.footer.durabilityMax).toBe(120);
  });

  it('shows what a tool can do and its multiplier', () => {
    const axe = resolveItemTooltip(HEXOBJECT_KEYS.AXE);
    expect(axe.headline).toMatchObject({ kind: 'multiplier', min: 1, max: 1 });
    expect(axe.capabilities).toEqual(['cut', 'attack']);
  });

  it('compares with the equipped item of the same kind', () => {
    const better = resolveItemTooltip(HEXOBJECT_KEYS.SHIELD, { compareWith: HEXOBJECT_KEYS.HAND });
    expect(better.headline?.comparison).toEqual({ direction: 'better', delta: 2.3 });
    const worse = resolveItemTooltip(HEXOBJECT_KEYS.HAND, { compareWith: HEXOBJECT_KEYS.SHIELD });
    expect(worse.headline?.comparison).toEqual({ direction: 'worse', delta: -2.3 });
    const same = resolveItemTooltip(HEXOBJECT_KEYS.AXE, { compareWith: HEXOBJECT_KEYS.PICKAXE });
    expect(same.headline?.comparison?.direction).toBe('same');
  });

  it('does not compare different kinds or an item with itself', () => {
    expect(
      resolveItemTooltip(HEXOBJECT_KEYS.SWORD, { compareWith: HEXOBJECT_KEYS.SHIELD }).headline
        ?.comparison,
    ).toBeUndefined();
    expect(
      resolveItemTooltip(HEXOBJECT_KEYS.AXE, { compareWith: HEXOBJECT_KEYS.AXE }).headline
        ?.comparison,
    ).toBeUndefined();
  });

  it('reports equipped state and stack amount', () => {
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SWORD, { equipped: true }).equipped).toBe(true);
    const coins = resolveItemTooltip(HEXOBJECT_KEYS.COINS, { amount: 7 });
    expect(coins.footer.stack?.amount).toBe(7);
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SWORD).footer.stack).toBeUndefined();
  });

  it('leaves out sections an item has no data for', () => {
    const coins = resolveItemTooltip(HEXOBJECT_KEYS.COINS);
    expect(coins.headline).toBeUndefined();
    expect(coins.capabilities).toEqual([]);
    expect(coins.footer.durabilityMax).toBeUndefined();
  });

  it('reports the shields an item gives', () => {
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SHIELD).shields).toBe(1);
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SWORD).shields).toBe(0);
    expect(resolveItemTooltip(HEXOBJECT_KEYS.COINS).shields).toBe(0);
  });

  it('reports the hearts an item gives', () => {
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SHIELD).hearts).toBe(1);
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SWORD).hearts).toBe(0);
  });
});

describe('resolveItemTooltip Will price of use', () => {
  it('prices the Return Scroll by the Teleport skill rank', () => {
    expect(
      resolveItemTooltip(HEXOBJECT_KEYS.RETURN_SCROLL, { skills: { a_teleport: 1 } }).use,
    ).toEqual({
      kind: 'cost',
      will: 10,
      skillId: 'a_teleport',
    });
    expect(
      resolveItemTooltip(HEXOBJECT_KEYS.RETURN_SCROLL, { skills: { a_teleport: 10 } }).use,
    ).toEqual({
      kind: 'cost',
      will: 1,
      skillId: 'a_teleport',
    });
  });

  it('marks the Return Scroll as locked and shows the first-rank price without the Teleport skill', () => {
    expect(resolveItemTooltip(HEXOBJECT_KEYS.RETURN_SCROLL).use).toEqual({
      kind: 'locked',
      will: 10,
      skillId: 'a_teleport',
    });
  });

  it('shows nothing for items that cost no Will to use', () => {
    expect(resolveItemTooltip(HEXOBJECT_KEYS.SWORD).use).toBeUndefined();
  });
});
