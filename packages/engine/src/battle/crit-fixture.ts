import { BATTLE_RULES } from './battle-content';
import type { BattleState } from './battle-state';
import { isFreeHex } from './battle-board';
import { hexKey, hexNeighbours } from './hex-battle-geom';
import { deriveStream } from '../utils/random-seeded';

/** Dev-only arrangement: a favourable real roll, never a forced critical outcome. */
export function prepareCritTarget(battle: BattleState): void {
  const hero = battle.creatures.find((creature) => creature.side === 'heroes');
  const target = battle.creatures.find(
    (creature) => creature.side === 'enemies' && creature.hp > 0,
  );
  if (!hero || !target || battle.phase === 'ended') throw new Error('No living critical target');
  const spot = hexNeighbours(hero.pos).find((hex) => isFreeHex(battle, hex, target.id));
  if (!spot) throw new Error('No adjacent critical target hex');
  battle.creatures = [hero, target];
  battle.board[hexKey(hero.pos)] = 'floor';
  battle.board[hexKey(spot)] = 'floor';
  target.pos = spot;
  target.hp = target.maxHp = 30;
  target.hands = { right: null, left: null };
  battle.order = [hero.id, target.id];
  battle.activeId = hero.id;
  battle.turnIndex = 0;
  battle.phase = 'act';
  battle.turnWill = BATTLE_RULES.willPerTurn;
  battle.pending = [];
  battle.reaction = undefined;
  battle.placedShields = [];
  battle.struckHands = [];
  battle.undo = [];
  for (let index = battle.strikeSeq; index < battle.strikeSeq + 10_000; index++) {
    const rng = deriveStream(battle.seed, `combat:${battle.id}:strike:${index + 1}:crit`);
    if (rng() < 0.02) {
      battle.strikeSeq = index;
      return;
    }
  }
  throw new Error('No favourable critical roll');
}
