import type { DomainEvent } from '../commands/types';
import type { RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';
import { BATTLE_RULES, type BattleRules } from './battle-content';
import type { BattleAction } from './battle-commands';
import type { BattleHand, BattleOutcome, BattleSetupInput, BattleState } from './battle-state';
import { applyBattleCommand } from './apply-battle';
import { startBattle } from './start-battle';
import { projectBattleForViewer, type BattleProjection } from './projection';
import { activeSelf, aimAction } from './ai/ai-common';
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
  const aim = aimAction(view, self, rules);
  if (aim) return aim;
  const potionHand = (['right', 'left'] as BattleHand[]).find((h) => self.hands[h]?.usePrice);
  const potionPrice = potionHand ? self.hands[potionHand]!.usePrice! : 0;
  if (view.phase === 'act' && potionHand && self.hp <= 2 && view.turnWill >= potionPrice) {
    return { kind: 'use-item', hand: potionHand };
  }
  return meleeAction(view, rules, false);
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
  setup: BattleSetupInput,
  overrides: Partial<SimOptions> = {},
): BattleOutcome | 'stalemate' {
  const options = { ...DEFAULT_SIM, ...overrides };
  const rng = deriveStream(setup.seed, 'sim:answers');
  let battle = startBattle(setup, options.rules).battle;
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
