import type { DomainEvent } from '../commands/types';
import type { RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';
import { BATTLE_RULES, type BattleRules } from './battle-content';
import type { BattleAction } from './battle-commands';
import type {
  BattleCreature,
  BattleHand,
  BattleHex,
  BattleOutcome,
  BattleState,
  BattleTerrain,
} from './battle-state';
import { applyBattleCommand } from './apply-battle';
import { startBattle } from './start-battle';
import { shieldCapacity } from './defend';
import { battleDistance, hexKey } from './hex-battle-geom';
import { projectBattleForViewer, type BattleProjection } from './projection';
import { activeSelf } from './ai/ai-common';
import { meleeAction } from './ai/melee-ai';

export interface SimOptions {
  accuracy: number;
  maxRounds: number;
  rules: BattleRules;
  onEvents?: (events: DomainEvent[]) => void;
}

const DEFAULT_SIM: SimOptions = { accuracy: 0.8, maxRounds: 30, rules: BATTLE_RULES };
const ANSWER_DELAY_MS = 2_000;
const MAX_COMMANDS = 5_000;

export function heroBotAction(view: BattleProjection, rules: BattleRules): BattleAction {
  const self = activeSelf(view);
  if (
    view.phase === 'defend' &&
    shieldCapacity(self, rules) === 0 &&
    view.turnWill >= rules.dodge
  ) {
    return { kind: 'start-dodge' };
  }
  const potionHand = (['right', 'left'] as BattleHand[]).find((h) => self.hands[h]?.heal);
  if (view.phase === 'act' && potionHand && self.hp <= 2 && view.turnWill >= rules.use) {
    return { kind: 'use-item', hand: potionHand };
  }
  return meleeAction(view, rules, false);
}

export function simArena(seed: string, radius = 4): Record<string, BattleTerrain> {
  const rng = deriveStream(seed, 'sim:arena');
  const board: Record<string, BattleTerrain> = {};
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const hex = { q, r };
      if (battleDistance(hex, { q: 0, r: 0 }) > radius) continue;
      const roll = rng();
      const middle = Math.abs(q) <= radius - 2;
      board[hexKey(hex)] = !middle
        ? 'floor'
        : roll < 0.06
          ? 'wall'
          : roll < 0.14
            ? 'rubble'
            : roll < 0.18
              ? 'ledge'
              : roll < 0.2
                ? 'oil'
                : roll < 0.22
                  ? 'saw'
                  : 'floor';
    }
  }
  return board;
}

export function spawnHexes(radius: number, side: 'heroes' | 'enemies', count: number): BattleHex[] {
  const q = side === 'heroes' ? -radius : radius;
  const column: BattleHex[] = [];
  for (let r = -radius; r <= radius; r++) {
    if (battleDistance({ q, r }, { q: 0, r: 0 }) <= radius) column.push({ q, r });
  }
  const height = (hex: BattleHex) => Math.abs(2 * hex.r + hex.q);
  return column.sort((a, b) => height(a) - height(b) || a.r - b.r).slice(0, count);
}

function answerTask(battle: BattleState, rng: RandomNumberGenerator, accuracy: number) {
  const task = battle.task!;
  const right = rng() < accuracy;
  const option = task.options.findIndex((o) => (right ? o === task.answer : o !== task.answer));
  return {
    kind: 'hero' as const,
    heroId: task.creatureId,
    atMs: task.issuedAtMs + ANSWER_DELAY_MS,
    action: { kind: 'answer-task' as const, option },
  };
}

function nextPayload(
  battle: BattleState,
  atMs: number,
  rng: RandomNumberGenerator,
  options: SimOptions,
) {
  if (battle.task) return answerTask(battle, rng, options.accuracy);
  const active = battle.creatures.find((c) => c.id === battle.activeId)!;
  if (active.side === 'enemies') return { kind: 'run-enemy-turn' as const, atMs };
  const action = heroBotAction(projectBattleForViewer(battle, 'heroes'), options.rules);
  return { kind: 'hero' as const, heroId: active.id, atMs, action };
}

export function simulateBattle(
  seed: string,
  creatures: BattleCreature[],
  board: Record<string, BattleTerrain>,
  overrides: Partial<SimOptions> = {},
): BattleOutcome | 'stalemate' {
  const options = { ...DEFAULT_SIM, ...overrides };
  const rng = deriveStream(seed, 'sim:answers');
  let battle = startBattle({ id: 'sim', seed, board, creatures }, options.rules).battle;
  for (let i = 0, atMs = 0; i < MAX_COMMANDS; i++, atMs += 1_000) {
    if (battle.outcome) return battle.outcome;
    if (battle.round > options.maxRounds) return 'stalemate';
    const payload = nextPayload(battle, atMs, rng, options);
    const result = applyBattleCommand(battle, { type: 'BATTLE', payload }, options.rules);
    const refused = result.events.some((e) => e.type === 'BATTLE_REJECTED');
    if (refused && payload.kind === 'hero') {
      const end = { ...payload, action: { kind: 'end-turn' as const } };
      battle = applyBattleCommand(battle, { type: 'BATTLE', payload: end }, options.rules).battle!;
    } else {
      battle = result.battle!;
    }
    options.onEvents?.(result.events);
  }
  return 'stalemate';
}
