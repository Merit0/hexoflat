import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { applyBattleCommand } from '@hexoflat/engine/battle/apply-battle';
import { isFightCommand, type BattleCommand } from '@hexoflat/engine/battle/battle-commands';
import type { BattleSetupInput, BattleState } from '@hexoflat/engine/battle/battle-state';
import { projectBattleEvent, projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import type { BattleReply, BattleRequest } from '@/services/battle/battle-server';
import type { BattleServerBridge } from '@/stores/battle-store';

export interface DevBattleBridge extends BattleServerBridge {
  reset(): void;
  peek(): BattleState | undefined;
  replace(next: BattleState): void;
}

function replyOf(state: BattleState | undefined, raw: DomainEvent[]): BattleReply {
  const refused = raw.find((event) => event.type === 'BATTLE_REJECTED');
  const events = state ? raw.map((event) => projectBattleEvent(state, event, 'heroes')) : raw;
  const code = refused ? String((refused.payload as { rejected: string }).rejected) : null;
  return {
    ok: !refused,
    code,
    steps: state ? [{ battle: projectBattleForViewer(state, 'heroes'), events }] : [],
    events,
    closed: false,
    result: null,
  };
}

export function createDevBattleBridge(
  setup: () => BattleSetupInput | null,
  onClose: () => void,
  clock: () => number = Date.now,
): DevBattleBridge {
  let state: BattleState | undefined;

  function command(request: BattleRequest): BattleCommand | null {
    if (!state) return null;
    const atMs = clock();
    if (request.kind === 'run-enemy-turn') {
      return { type: 'BATTLE', payload: { kind: 'run-enemy-turn', atMs } };
    }
    if (request.kind !== 'hero') return null;
    const owner = state.task?.creatureId ?? state.activeId;
    return {
      type: 'BATTLE',
      payload: { kind: 'hero', heroId: owner, atMs, action: request.action },
    };
  }

  return {
    reset() {
      state = undefined;
    },
    peek() {
      return state;
    },
    replace(next) {
      state = next;
    },
    request(request) {
      if (request.kind === 'start') {
        const input = setup();
        if (!input)
          return Promise.resolve({ ...replyOf(undefined, []), ok: false, code: 'NO_ENGAGEMENT' });
        const started = startBattle(input);
        state = started.battle;
        return Promise.resolve(replyOf(state, started.events));
      }
      if (request.kind === 'close') {
        onClose();
        return Promise.resolve(replyOf(undefined, []));
      }
      const next = command(request);
      if (!next || !isFightCommand(next))
        return Promise.resolve({ ...replyOf(undefined, []), ok: false, code: 'NO_BATTLE' });
      const result = applyBattleCommand(state, next);
      if (result.battle) state = result.battle;
      return Promise.resolve(replyOf(state, result.events));
    },
    onStep() {},
    closed() {
      onClose();
      return Promise.resolve();
    },
    restore() {
      return Promise.resolve(null);
    },
  };
}
