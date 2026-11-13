import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { deriveStream } from '../utils/random-seeded';
import { applyBattleCommand } from './apply-battle';
import { isFreeHex, isPassableHex } from './battle-board';
import { BATTLE_RULES } from './battle-content';
import { battlefieldSeed, generateBattlefield } from './battlefield';
import { deployBattle } from './battlefield-setup';
import { heroBotAction } from './battle-sim';
import type { BattleState } from './battle-state';
import { hero } from './battle-test-setup';
import { graveAt } from './collect';
import { hexKey, hexNeighbours } from './hex-battle-geom';
import { projectBattleForViewer } from './projection';
import { startBattle } from './start-battle';

const ON = { ...BATTLE_RULES, graveLootEnabled: true };
const SEEDS = 500;
const MAX_COMMANDS = 2_000;
const SQUAD = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'];

function playOut(seed: number): BattleState {
  const { setup } = deployBattle({
    battleId: `sweep-${seed}`,
    field: generateBattlefield('crypt', battlefieldSeed(`collect-${seed}`, 0)),
    heroes: [hero({ q: 0, r: 0 })],
    members: SQUAD,
    direction: { x: -1, y: 0 },
    ambush: false,
  });
  const rng = deriveStream(setup.seed, 'sim:answers');
  let battle = startBattle(setup, ON).battle;
  for (let i = 0, atMs = 0; i < MAX_COMMANDS && !battle.outcome; i++, atMs += 1_000) {
    if (battle.round > 30) break;
    const task = battle.task;
    const active = battle.creatures.find((c) => c.id === battle.activeId)!;
    const payload = task
      ? {
          kind: 'hero' as const,
          heroId: task.creatureId,
          atMs: task.issuedAtMs + 2_000,
          action: {
            kind: 'answer-task' as const,
            option: task.options.findIndex((o) =>
              rng() < 0.8 ? o === task.answer : o !== task.answer,
            ),
          },
        }
      : active.side === 'enemies'
        ? { kind: 'run-enemy-turn' as const, atMs }
        : {
            kind: 'hero' as const,
            heroId: active.id,
            atMs,
            action: heroBotAction(projectBattleForViewer(battle, 'heroes'), ON),
          };
    const result = applyBattleCommand(battle, { type: 'BATTLE', payload }, ON);
    const refused = result.events.some((e) => e.type === 'BATTLE_REJECTED');
    battle =
      refused && payload.kind === 'hero'
        ? applyBattleCommand(
            battle,
            { type: 'BATTLE', payload: { ...payload, action: { kind: 'end-turn' as const } } },
            ON,
          ).battle!
        : result.battle!;
  }
  return battle;
}

describe('REQ-LOOT-087 500 battles played by the hero bot', () => {
  it('makes one grave per death hex and never drops loot onto a grave, a wall or the entry hex', () => {
    let victories = 0;
    let looted = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const battle = playOut(seed);
      if (battle.outcome !== 'victory') {
        expect(battle.collect).toBeUndefined();
        continue;
      }
      victories++;
      const deathHexes = new Set(
        battle.creatures
          .filter((c) => c.side === 'enemies' && c.hp === 0)
          .map((c) => hexKey(c.pos)),
      );
      expect(battle.collect!.graves.map((g) => hexKey(g.hex)).sort()).toEqual(
        [...deathHexes].sort(),
      );

      for (const grave of [...battle.collect!.graves]) {
        const player = battle.creatures.find((c) => c.side === 'heroes')!;
        const around = hexNeighbours(grave.hex).filter((hex) => isFreeHex(battle, hex, player.id));
        if (around.length === 0) continue;
        const entry = around[0];
        player.pos = { ...entry };
        const before = battle.collect!.items.length;
        const result = applyBattleCommand(
          battle,
          {
            type: 'BATTLE',
            payload: {
              kind: 'hero',
              heroId: player.id,
              atMs: 0,
              action: { kind: 'loot-grave', hex: grave.hex },
            },
          },
          ON,
          { inventory: { current: emptyInventoryState(player.id), events: [] } },
        );
        if (result.events.some((e) => e.type === 'BATTLE_REJECTED')) continue;
        looted++;
        const next = result.battle!;
        const fresh = next.collect!.items.slice(before);
        for (const item of fresh) {
          expect(isPassableHex(next, item.hex)).toBe(true);
          expect(graveAt(next.collect!, item.hex)).toBeNull();
          expect(hexKey(item.hex)).not.toBe(hexKey(entry));
        }
        expect(next.collect!.items.some((item) => hexKey(item.hex) === hexKey(entry))).toBe(false);
        expect(new Set(next.collect!.items.map((item) => hexKey(item.hex))).size).toBe(
          next.collect!.items.length,
        );
        battle.collect = next.collect;
        battle.creatures = next.creatures;
      }
    }
    expect(victories).toBeGreaterThan(50);
    expect(looted).toBeGreaterThan(50);
  }, 240_000);
});
