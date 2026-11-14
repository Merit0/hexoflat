import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { applyBattleCommand } from './apply-battle';
import { isFreeHex, isPassableHex } from './battle-board';
import { BATTLE_RULES } from './battle-content';
import type { BattleState } from './battle-state';
import { playOutSquad } from './collect-playout-setup';
import { graveAt } from './collect';
import { hexKey, hexNeighbours } from './hex-battle-geom';

const ON = { ...BATTLE_RULES, graveLootEnabled: true };
const SEEDS = 500;
const SQUAD = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'];

function playOut(seed: number): BattleState {
  return playOutSquad(SQUAD, `sweep-${seed}`, `collect-${seed}`);
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
