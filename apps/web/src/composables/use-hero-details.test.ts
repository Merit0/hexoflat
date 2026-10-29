import { describe, expect, it } from 'vitest';
import { buildHeroDetails, SHIELD_SLOTS, type HeroDetailsInput } from './use-hero-details';

const base: HeroDetailsInput = {
  name: 'Aria',
  locationTitle: 'Camp',
  steps: 0,
  currentHealth: 3,
  maxHealth: 3,
  coins: 12,
  kills: 4,
  carriedKg: 1.8,
  capacityKg: 10,
  shieldPoints: 0,
  extraShields: 0,
  skills: {},
  skillProgress: {},
  skillsLocked: false,
  will: { current: 20, capacity: 50 },
  weapon: null,
  shield: null,
  defense: 0,
};

const swordItem = { titleKey: 'content.sword.title', rarity: null, willCost: null };
const shieldItem = { titleKey: 'content.shield.title', rarity: null, willCost: null };
const sword = { item: swordItem, power: 2 };
const shield = { item: shieldItem, sides: 2 };

describe('buildHeroDetails', () => {
  it('counts one heart per max health point with half-heart precision', () => {
    expect(buildHeroDetails({ ...base, currentHealth: 2.5 }).hearts).toEqual({
      current: 2.5,
      max: 3,
      count: 3,
    });
    expect(buildHeroDetails({ ...base, maxHealth: 2.5 }).hearts.count).toBe(3);
  });

  it('clamps health into 0..max', () => {
    expect(buildHeroDetails({ ...base, currentHealth: 99 }).hearts.current).toBe(3);
    expect(buildHeroDetails({ ...base, currentHealth: -1 }).hearts.current).toBe(0);
  });

  it('shows the battle strike power of the weapon and the shield sides held', () => {
    const view = buildHeroDetails({ ...base, weapon: sword, shield, defense: 2 });
    expect(view.tiles.find((tile) => tile.id === 'attack')?.value).toBe('2');
    expect(view.tiles.find((tile) => tile.id === 'defense')?.value).toBe('2');
  });

  it('falls back to the unarmed power and zero shield sides with nothing equipped', () => {
    const view = buildHeroDetails(base);
    expect(view.tiles.find((tile) => tile.id === 'attack')?.value).toBe('1');
    expect(view.tiles.find((tile) => tile.id === 'defense')?.value).toBe('0');
  });

  it('shows what is held in each hand', () => {
    const view = buildHeroDetails({ ...base, weapon: sword, shield, defense: 2.4 });
    expect(view.hands).toEqual({ right: swordItem, left: shieldItem });
  });

  it('leaves a hand empty when nothing is held in it', () => {
    expect(buildHeroDetails({ ...base, weapon: sword }).hands).toEqual({
      right: swordItem,
      left: null,
    });
    expect(buildHeroDetails(base).hands).toEqual({ right: null, left: null });
  });

  it('shows no shields without a source of shield points, whatever the defence', () => {
    expect(buildHeroDetails({ ...base, defense: 2.4 }).shields).toEqual({
      filled: 0,
      total: SHIELD_SLOTS,
    });
    expect(buildHeroDetails({ ...base, defense: 2.4, extraShields: 3 }).shields.filled).toBe(0);
  });

  it('fills one shield nest per shield point of what is worn, not per defence point', () => {
    expect(buildHeroDetails({ ...base, shieldPoints: 1, defense: 2.4 }).shields).toEqual({
      filled: 1,
      total: SHIELD_SLOTS,
    });
    expect(buildHeroDetails({ ...base, shieldPoints: 6, defense: 0 }).shields.filled).toBe(
      SHIELD_SLOTS,
    );
  });

  it('adds extra shields on top, capped at the slot count', () => {
    expect(buildHeroDetails({ ...base, shieldPoints: 1, extraShields: 2 }).shields.filled).toBe(3);
    expect(buildHeroDetails({ ...base, shieldPoints: 1, extraShields: 40 }).shields.filled).toBe(
      SHIELD_SLOTS,
    );
  });

  it('passes Will through, or null when the hero has none', () => {
    expect(buildHeroDetails(base).will).toEqual({ current: 20, capacity: 50 });
    expect(buildHeroDetails({ ...base, will: null }).will).toBeNull();
  });

  it('lists stat tiles without a knockback tile and formats the load', () => {
    const tiles = buildHeroDetails(base).tiles;
    expect(tiles.map((tile) => tile.id)).toEqual(['attack', 'defense', 'load', 'victories']);
    expect(tiles[2].value).toBe('1.80 / 10.00');
    expect(tiles[3].value).toBe('4');
  });

  it('computes progress toward the next scout rank', () => {
    const start = buildHeroDetails({ ...base, steps: 0 });
    expect(start.rank.roman).toBe('I');
    expect(start.scout).toMatchObject({ nextAt: 100, percent: 0 });
    const middle = buildHeroDetails({ ...base, steps: 150 });
    expect(middle.rank.roman).toBe('II');
    expect(middle.scout).toMatchObject({ nextAt: 200, percent: 50 });
  });

  it('fills the progress bar at the top scout rank', () => {
    const top = buildHeroDetails({ ...base, steps: 5000 });
    expect(top.rank.roman).toBe('X');
    expect(top.scout.nextAt).toBeNull();
    expect(top.scout.percent).toBe(100);
  });

  it('does not add skill bonuses to battle numbers until decision C3', () => {
    const view = buildHeroDetails({
      ...base,
      weapon: sword,
      defense: 2,
      skills: { b_strike: 4, b_guard: 6 },
    });
    expect(view.tiles.find((tile) => tile.id === 'attack')?.value).toBe('2');
    expect(view.tiles.find((tile) => tile.id === 'defense')?.value).toBe('2');
    expect(view.shields.filled).toBe(0);
  });
});
