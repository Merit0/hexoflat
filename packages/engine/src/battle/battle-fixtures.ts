import { z } from 'zod';
import type { BattleState } from './battle-state';
import { isFreeHex } from './battle-board';
import { battleDistance, hexKey } from './hex-battle-geom';

export const battleFixtureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hero-turn'), will: z.number().int().min(0).max(50) }).strict(),
  z.object({ kind: z.literal('enemy-turn'), will: z.number().int().min(0).max(50) }).strict(),
  z
    .object({
      kind: z.literal('crowd'),
      adjacent: z.number().int().min(0).max(6),
      far: z.number().int().min(0).max(6),
    })
    .strict(),
  z
    .object({ kind: z.literal('hold-window'), extraMs: z.number().int().min(0).max(600_000) })
    .strict(),
  z.object({ kind: z.literal('finish'), outcome: z.enum(['victory', 'defeat']) }).strict(),
]);

export type BattleFixture = z.infer<typeof battleFixtureSchema>;

type Hex = { q: number; r: number };

function floorHexes(battle: BattleState): Hex[] {
  return Object.keys(battle.board)
    .map((key) => ({ q: Number(key.split(',')[0]), r: Number(key.split(',')[1]) }))
    .filter((hex) => battle.board[hexKey(hex)] === 'floor');
}

function clearTurnState(battle: BattleState, will: number): void {
  battle.turnIndex = 0;
  battle.phase = 'act';
  battle.turnWill = will;
  battle.pending = [];
  battle.reaction = undefined;
  battle.placedShields = [];
  battle.struckHands = [];
  battle.undo = [];
  battle.wounds = {};
}

function giveHeroTurn(battle: BattleState, will: number): void {
  const hero = battle.creatures.find((creature) => creature.side === 'heroes');
  if (!hero) throw new Error('No hero in the battle');
  battle.order = [hero.id, ...battle.order.filter((id) => id !== hero.id)];
  battle.activeId = hero.id;
  clearTurnState(battle, will);
}

function giveEnemyTurn(battle: BattleState, will: number): void {
  const living = battle.creatures.filter((c) => c.side === 'enemies' && c.hp > 0);
  const enemy = living.find((c) => c.kind === 'skeleton-warrior') ?? living[0];
  const hero = battle.creatures.find((c) => c.side === 'heroes');
  if (!enemy || !hero) throw new Error('No living enemy or hero in the battle');
  const spot = floorHexes(battle).find(
    (hex) => battleDistance(hex, hero.pos) === 2 && isFreeHex(battle, hex),
  );
  if (spot) enemy.pos = spot;
  battle.order = [enemy.id, ...battle.order.filter((id) => id !== enemy.id)];
  battle.activeId = enemy.id;
  clearTurnState(battle, will);
}

function crowd(battle: BattleState, adjacent: number, far: number): void {
  const hero = battle.creatures.find((creature) => creature.side === 'heroes');
  if (!hero) throw new Error('No hero in the battle');
  const enemies = battle.creatures.filter((c) => c.side === 'enemies' && c.hp > 0);
  const floor = floorHexes(battle);
  const place = (enemy: (typeof enemies)[number], distance: number) => {
    const spot = floor.find(
      (hex) => battleDistance(hex, hero.pos) === distance && isFreeHex(battle, hex),
    );
    if (spot) enemy.pos = spot;
  };
  enemies.slice(0, adjacent).forEach((enemy) => place(enemy, 1));
  enemies.slice(adjacent, adjacent + far).forEach((enemy) => place(enemy, 2));
}

function finish(battle: BattleState, outcome: 'victory' | 'defeat'): void {
  const loser = outcome === 'victory' ? 'enemies' : 'heroes';
  for (const creature of battle.creatures) if (creature.side === loser) creature.hp = 0;
  battle.outcome = outcome;
  battle.phase = 'ended';
}

export function applyBattleFixture(source: BattleState, fixture: BattleFixture): BattleState {
  const battle = structuredClone(source);
  switch (fixture.kind) {
    case 'hero-turn':
      giveHeroTurn(battle, fixture.will);
      break;
    case 'enemy-turn':
      giveEnemyTurn(battle, fixture.will);
      break;
    case 'crowd':
      crowd(battle, fixture.adjacent, fixture.far);
      break;
    case 'hold-window':
      if (!battle.reaction) throw new Error('No block window is open');
      battle.reaction.deadlineMs += fixture.extraMs;
      break;
    case 'finish':
      finish(battle, fixture.outcome);
      break;
  }
  return battle;
}
