import type { DomainEvent } from '../commands/types';
import { BATTLE_RULES } from './battle-content';
import type { BattleAction } from './battle-commands';
import type {
  BattleCreature,
  BattleHex,
  BattleState,
  BattleTerrain,
  Boulder,
} from './battle-state';
import { applyBattleCommand } from './apply-battle';
import { startBattle } from './start-battle';
import { battleDistance, hexKey } from './hex-battle-geom';
import { beginTurn } from './turn';

export function hexagonBoard(
  radius = 3,
  overrides: Record<string, BattleTerrain> = {},
): Record<string, BattleTerrain> {
  const board: Record<string, BattleTerrain> = {};
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (battleDistance({ q, r }, { q: 0, r: 0 }) <= radius) board[hexKey({ q, r })] = 'floor';
    }
  }
  return { ...board, ...overrides };
}

export function hero(pos: BattleHex, overrides: Partial<BattleCreature> = {}): BattleCreature {
  return {
    id: 'hero',
    side: 'heroes',
    kind: 'hero',
    pos,
    hp: 6,
    maxHp: 6,
    weight: 1,
    force: 1,
    hands: {
      right: { key: 'sword', power: 2 },
      left: { key: 'wooden-shield', shieldCapacity: 2 },
    },
    ...overrides,
  };
}

export function skeleton(
  id: string,
  pos: BattleHex,
  overrides: Partial<BattleCreature> = {},
): BattleCreature {
  return {
    id,
    side: 'enemies',
    kind: 'skeleton-warrior',
    pos,
    hp: 3,
    maxHp: 3,
    weight: 1,
    force: 1,
    hands: { right: { key: 'bone-blade', power: 1 }, left: null },
    ...overrides,
  };
}

export function battleWith(
  creatures: BattleCreature[],
  board: Record<string, BattleTerrain> = hexagonBoard(),
  seed = 'test-seed',
  boulders: Boulder[] = [],
): BattleState {
  return startBattle({ id: 'b1', seed, board, creatures, boulders }).battle;
}

export function rightAnswer(battle: BattleState): number {
  return battle.task!.options.indexOf(battle.task!.answer);
}

export function wrongAnswer(battle: BattleState): number {
  return battle.task!.options.findIndex((o) => o !== battle.task!.answer);
}

export function giveTurn(battle: BattleState, order: string[]): BattleState {
  battle.order = order;
  battle.draws = Object.fromEntries(order.map((id, i) => [id, order.length - i]));
  battle.turnIndex = 0;
  beginTurn(battle, order[0], BATTLE_RULES);
  return battle;
}

export function heroDoes(
  battle: BattleState,
  action: BattleAction,
  heroId = 'hero',
  atMs = 0,
): { battle: BattleState; events: DomainEvent[] } {
  const result = applyBattleCommand(battle, {
    type: 'BATTLE',
    payload: { kind: 'hero', heroId, atMs, action },
  });
  return { battle: result.battle!, events: result.events };
}

export function enemyTurn(
  battle: BattleState,
  atMs = 0,
): { battle: BattleState; events: DomainEvent[] } {
  const result = applyBattleCommand(battle, {
    type: 'BATTLE',
    payload: { kind: 'run-enemy-turn', atMs },
  });
  return { battle: result.battle!, events: result.events };
}

export function eventTypes(events: DomainEvent[]): string[] {
  return events.map((e) => e.type);
}

export function rejectionOf(events: DomainEvent[]): unknown {
  const refusal = events.find((e) => e.type === 'BATTLE_REJECTED');
  return refusal ? (refusal.payload as { rejected: string }).rejected : null;
}
