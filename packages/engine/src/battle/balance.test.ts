import { describe, expect, it } from 'vitest';
import { deployBattle } from './battlefield-setup';
import { battlefieldSeed, generateBattlefield } from './battlefield';
import { hero } from './battle-test-setup';
import { simulateBattle } from './battle-sim';

const SEEDS = 500;

function winRate(members: string[], heroCount: number): number {
  let wins = 0;
  for (let n = 0; n < SEEDS; n++) {
    const { setup } = deployBattle({
      battleId: 'sim',
      field: generateBattlefield('crypt', battlefieldSeed(`balance-${n}`, 0)),
      heroes: Array.from({ length: heroCount }, (_, i) =>
        hero({ q: 0, r: 0 }, { id: `hero-${i}` }),
      ),
      members,
      direction: { x: -1, y: 0 },
      ambush: false,
    });
    if (simulateBattle(setup) === 'victory') wins++;
  }
  return wins / SEEDS;
}

describe('REQ-BTL-016 balance (hero bot, 500 seeds)', () => {
  it('one hero beats two skeleton warriors 60–85% of the time', { timeout: 120_000 }, () => {
    const rate = winRate(['skeleton-warrior', 'skeleton-warrior'], 1);
    console.info(`2 warriors vs 1 hero: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.6);
    expect(rate).toBeLessThanOrEqual(0.85);
  });

  it('two heroes beat the full crypt squad 40–60% of the time', { timeout: 120_000 }, () => {
    const squad = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior', 'skeleton-archer'];
    const rate = winRate(squad, 2);
    console.info(`full squad vs 2 heroes: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.4);
    expect(rate).toBeLessThanOrEqual(0.6);
  });
});
