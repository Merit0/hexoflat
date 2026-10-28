import { describe, expect, it } from 'vitest';
import { generateBattlefield, battlefieldSeed } from '../battle/battlefield';
import { drawWithAdvantage } from '../battle/initiative';
import { startBattle } from '../battle/start-battle';
import { hero } from '../battle/battle-test-setup';
import { battleDistance, hexKey } from '../battle/hex-battle-geom';
import { createSeededRandom } from '../utils/random-seeded';
import {
  DEPLOYMENT_RULES,
  approachDirection,
  cosineTo,
  deployBattle,
  type Vector,
} from './battlefield-setup';

const SQUAD = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior', 'skeleton-archer'];
const FROM_WEST: Vector = { x: -1, y: 0 };

function deploy(seed: string, ambush: boolean, direction = FROM_WEST) {
  return deployBattle({
    battleId: 'b',
    field: generateBattlefield('crypt', battlefieldSeed(seed, 0)),
    heroes: [hero({ q: 0, r: 0 }, { id: 'h1' }), hero({ q: 0, r: 0 }, { id: 'h2' })],
    members: SQUAD,
    direction,
    ambush,
  });
}

const centre = { q: 0, r: 0 };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('REQ-ENC-005 deployment', () => {
  it('points the approach from the encounter towards the hero', () => {
    const d = approachDirection({ columnIndex: 5, rowIndex: 4 }, { columnIndex: 3, rowIndex: 4 });
    expect(d.x).toBeCloseTo(-1);
    expect(d.y).toBeCloseTo(0);
  });

  it('puts the heroes on the edge they came from and the enemies across, zones apart', () => {
    for (let n = 0; n < 50; n++) {
      const { setup, zones } = deploy(`enc-${n}`, false);
      const heroZone = new Set(zones.heroes.map(hexKey));
      expect(zones.enemies.some((h) => heroZone.has(hexKey(h)))).toBe(false);
      const [h1, h2, ...enemies] = setup.creatures;
      for (const h of [h1, h2]) {
        expect(battleDistance(h.pos, centre)).toBeGreaterThanOrEqual(
          DEPLOYMENT_RULES.heroZoneMinRing,
        );
        expect(cosineTo(h.pos, FROM_WEST)).toBeGreaterThan(DEPLOYMENT_RULES.heroZoneCos);
      }
      for (const e of enemies)
        expect(cosineTo(e.pos, FROM_WEST)).toBeLessThan(DEPLOYMENT_RULES.enemyZoneCos);
      const all = setup.creatures.map((c) => hexKey(c.pos));
      expect(new Set(all).size).toBe(all.length);
      expect(enemies.map((e) => e.kind)).toEqual(SQUAD);
    }
  });

  it('springs an ambush closer to the heroes and on their flanks', () => {
    const near: number[] = [];
    const far: number[] = [];
    for (let n = 0; n < 50; n++) {
      const ambush = deploy(`enc-${n}`, true).setup;
      const normal = deploy(`enc-${n}`, false).setup;
      const reach = (setup: typeof ambush) => {
        const heroes = setup.creatures.filter((c) => c.side === 'heroes');
        return mean(
          setup.creatures
            .filter((c) => c.side === 'enemies')
            .map((e) => Math.min(...heroes.map((h) => battleDistance(h.pos, e.pos)))),
        );
      };
      near.push(reach(ambush));
      far.push(reach(normal));
      for (const e of ambush.creatures.filter((c) => c.side === 'enemies')) {
        expect(cosineTo(e.pos, FROM_WEST)).toBeGreaterThanOrEqual(DEPLOYMENT_RULES.ambushCos[0]);
        expect(cosineTo(e.pos, FROM_WEST)).toBeLessThanOrEqual(DEPLOYMENT_RULES.ambushCos[1]);
      }
      expect(ambush.advantage).toBe('enemies');
      expect(normal.advantage).toBe('heroes');
    }
    expect(mean(near)).toBeLessThan(mean(far) - 1);
  });

  it('gives the favoured side the higher of two tokens in round 1, without repeats', () => {
    let favouredSum = 0;
    let plainSum = 0;
    for (let n = 0; n < 300; n++) {
      const draws = drawWithAdvantage(
        ['a', 'b', 'c', 'd'],
        new Set(['a']),
        createSeededRandom({ seed: `adv-${n}`, counter: 0 }),
      );
      expect(Object.values(draws).sort()).toEqual([1, 2, 3, 4]);
      favouredSum += draws.a;
      plainSum += draws.d;
    }
    expect(favouredSum / 300).toBeGreaterThan(plainSum / 300 + 0.5);
  });

  it('starts a deployed battle with the advantage only in round 1', () => {
    const { battle } = startBattle(deploy('enc-start', false).setup);
    expect(battle.round).toBe(1);
    expect(battle.advantage).toBe('heroes');
    expect(Object.values(battle.draws).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
