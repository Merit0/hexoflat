import { describe, expect, it } from 'vitest';
import { applyBattleCommand } from './apply-battle';
import { BATTLE_RULES } from './battle-content';
import { battlefieldSeed, generateBattlefield } from './battlefield';
import { deployBattle } from './battlefield-setup';
import { hero } from './battle-test-setup';
import { startBattle } from './start-battle';
import type { BattleState } from './battle-state';

const SQUADS = [
  ['skeleton-warrior', 'skeleton-warrior', 'skeleton-warrior'],
  ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'],
  ['skeleton-warrior', 'skeleton-warrior', 'skeleton-archer'],
];

function passiveFight(n: number): { outcome: string; commands: number } {
  const { setup } = deployBattle({
    battleId: `passive-${n}`,
    field: generateBattlefield('crypt', battlefieldSeed(`passive-${n}`, 0)),
    heroes: [hero({ q: 0, r: 0 }, { id: 'hero-0' })],
    members: SQUADS[n % SQUADS.length],
    direction: { x: -1, y: 0 },
    ambush: false,
  });
  let battle: BattleState = startBattle(setup, BATTLE_RULES).battle;
  for (let i = 0, atMs = 0; i < 500 && battle.phase !== 'ended'; i++, atMs += 300) {
    const active = battle.creatures.find((c) => c.id === battle.activeId)!;
    const payload =
      active.side === 'enemies'
        ? ({ kind: 'run-enemy-turn', atMs } as const)
        : ({
            kind: 'hero',
            heroId: active.id,
            atMs,
            action: { kind: battle.reaction ? 'reaction-timeout' : 'end-turn' },
          } as const);
    battle = applyBattleCommand(battle, { type: 'BATTLE', payload }).battle!;
    if (battle.outcome) return { outcome: battle.outcome, commands: i };
  }
  return { outcome: 'unfinished', commands: 500 };
}

describe('ad-hoc: a hero that does nothing', () => {
  it('is beaten by every squad, the enemies never deadlock holding back', () => {
    const results = Array.from({ length: 120 }, (_, n) => passiveFight(n));
    const outcomes = results.reduce<Record<string, number>>((sum, r) => {
      sum[r.outcome] = (sum[r.outcome] ?? 0) + 1;
      return sum;
    }, {});
    console.info('passive hero outcomes', JSON.stringify(outcomes));
    expect(outcomes.victory ?? 0).toBe(0);
    expect(outcomes.unfinished ?? 0).toBe(0);
  });
});
