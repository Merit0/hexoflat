import type { DomainEvent } from '../commands/types';
import { BATTLE_RULES, type BattleRules } from './battle-content';
import { battleSetupSchema, type BattleSetupInput, type BattleState } from './battle-state';
import type { BattleResult } from './apply-battle';
import { startRound } from './turn';

export function startBattle(
  setup: BattleSetupInput,
  rules: BattleRules = BATTLE_RULES,
): BattleResult {
  const parsed = battleSetupSchema.parse(setup);
  const battle: BattleState = {
    ...structuredClone(parsed),
    round: 0,
    draws: {},
    order: [],
    turnIndex: 0,
    activeId: '',
    phase: 'act',
    turnWill: 0,
    stance: {},
    struckHands: [],
    placedShields: [],
    wounds: {},
    pending: [],
    undo: [],
    strikeSeq: 0,
    taskSeq: 0,
  };
  const started: DomainEvent = {
    type: 'BATTLE_STARTED',
    payload: {
      battleId: battle.id,
      creatures: battle.creatures.map((c) => ({
        id: c.id,
        side: c.side,
        kind: c.kind,
        pos: c.pos,
      })),
    },
  };
  return { battle, events: [started, ...startRound(battle, rules)] };
}
