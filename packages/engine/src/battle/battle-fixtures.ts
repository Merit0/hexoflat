import { prepareCritTarget } from './crit-fixture';
import { z } from 'zod';
import type { BattleState } from './battle-state';
import { isFreeHex } from './battle-board';
import { battleDistance, hexKey, hexNeighbours } from './hex-battle-geom';
import { enterCollectPhase } from './collect';
import { issueTask } from './timed-task';
import { performAction } from './perform-action';
import { BATTLE_RULES } from './battle-content';

export const battleFixtureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trophy-target') }).strict(),
  z.object({ kind: z.literal('crit-target') }).strict(),
  z.object({ kind: z.literal('shield-strike'), openDirections: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('saw-task') }).strict(),
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
  z
    .object({ kind: z.literal('hero-base-crit'), heroBaseCrit: z.number().int().min(0).max(100) })
    .strict(),
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
  battle.task = undefined;
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
  if (outcome === 'victory' && battle.lootEnabled && !battle.collect) enterCollectPhase(battle);
}

export function applyBattleFixture(
  source: BattleState,
  fixture: BattleFixture,
  now = 0,
): BattleState {
  const battle = structuredClone(source);
  switch (fixture.kind) {
    case 'crit-target':
      prepareCritTarget(battle);
      break;
    case 'shield-strike': {
      if (fixture.openDirections) {
        const hero = battle.creatures.find((creature) => creature.side === 'heroes')!;
        const center = floorHexes(battle).find(
          (hex) =>
            isFreeHex(battle, hex, hero.id) &&
            hexNeighbours(hex).every(
              (near) =>
                battle.board[hexKey(near)] !== undefined &&
                !battle.creatures.some(
                  (creature) =>
                    creature.hp > 0 &&
                    creature.id !== hero.id &&
                    creature.pos.q === near.q &&
                    creature.pos.r === near.r,
                ),
            ),
        );
        if (!center) throw new Error('No six-side block fixture position');
        hero.pos = center;
        const ring = hexNeighbours(center);
        for (const hex of ring) battle.board[hexKey(hex)] = 'floor';
        battle.boulders = battle.boulders.filter(
          (boulder) => !ring.some((hex) => hex.q === boulder.pos.q && hex.r === boulder.pos.r),
        );
      }
      giveEnemyTurn(battle, BATTLE_RULES.strike);
      const enemy = battle.creatures.find((creature) => creature.id === battle.activeId)!;
      const hero = battle.creatures.find((creature) => creature.side === 'heroes')!;
      const spot = floorHexes(battle).find(
        (hex) => battleDistance(hex, hero.pos) === 1 && isFreeHex(battle, hex, enemy.id),
      );
      if (!spot) throw new Error('No adjacent shield attacker hex');
      enemy.pos = spot;
      enemy.hands = { right: { key: 'bone-blade', power: 2 }, left: null };
      const result = performAction(
        battle,
        enemy,
        { kind: 'strike', targetId: hero.id, hand: 'right' },
        now,
        BATTLE_RULES,
      );
      if (!Array.isArray(result) || !battle.reaction) throw new Error('No shield reaction');
      break;
    }
    case 'trophy-target': {
      const hero = battle.creatures.find((creature) => creature.side === 'heroes');
      const target = battle.creatures.find(
        (creature) => creature.side === 'enemies' && creature.hp > 0,
      );
      if (!hero || !target || battle.phase === 'ended') throw new Error('No living Trophy target');
      battle.creatures = [hero, target];
      const spot = floorHexes(battle).find(
        (hex) => battleDistance(hex, hero.pos) === 1 && isFreeHex(battle, hex, target.id),
      );
      if (!spot) throw new Error('No adjacent Trophy target hex');
      target.pos = spot;
      target.hp = 1;
      target.hands = { right: null, left: null };
      battle.order = [hero.id, target.id];
      giveHeroTurn(battle, BATTLE_RULES.willPerTurn);
      break;
    }
    case 'saw-task': {
      giveHeroTurn(battle, BATTLE_RULES.willPerTurn);
      const hero = battle.creatures.find((creature) => creature.side === 'heroes')!;
      issueTask(battle, 'saw', hero.id, now, BATTLE_RULES, { backHex: hero.pos });
      break;
    }
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
    case 'hero-base-crit':
      battle.critOverride = { heroBaseCrit: fixture.heroBaseCrit };
      break;
  }
  return battle;
}
