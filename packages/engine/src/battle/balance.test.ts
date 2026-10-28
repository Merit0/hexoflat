import { describe, expect, it } from 'vitest';
import { enemyCreature } from './battle-catalogue';
import type { BattleCreature } from './battle-state';
import { hero } from './battle-test-setup';
import { simArena, simulateBattle, spawnHexes } from './battle-sim';

const SEEDS = 500;
const RADIUS = 4;

function winRate(squad: string[], heroCount: number): number {
  let wins = 0;
  for (let n = 0; n < SEEDS; n++) {
    const seed = `balance-${n}`;
    const heroSpots = spawnHexes(RADIUS, 'heroes', heroCount);
    const enemySpots = spawnHexes(RADIUS, 'enemies', squad.length);
    const creatures: BattleCreature[] = [
      ...heroSpots.map((pos, i) => hero(pos, { id: `hero-${i}` })),
      ...squad.map((kind, i) => enemyCreature(kind, `${kind}-${i}`, enemySpots[i])),
    ];
    if (simulateBattle(seed, creatures, simArena(seed, RADIUS)) === 'victory') wins++;
  }
  return wins / SEEDS;
}

describe('REQ-BTL-016 balance (hero bot, 500 seeds)', () => {
  it('one hero beats two skeleton warriors 70–85% of the time', { timeout: 120_000 }, () => {
    const rate = winRate(['skeleton-warrior', 'skeleton-warrior'], 1);
    console.info(`2 warriors vs 1 hero: ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.7);
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
