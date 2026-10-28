import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { applyBattleCommand } from '@hexoflat/engine/battle/apply-battle';
import {
  BattleCommandSchema,
  type BattleAction,
  type BattleCommand,
} from '@hexoflat/engine/battle/battle-commands';
import type { BattleSetupInput, BattleState } from '@hexoflat/engine/battle/battle-state';
import type { BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import { creatureById } from '@hexoflat/engine/battle/battle-board';
import { projectBattleEvent, projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import type { DeploymentZones } from '@hexoflat/engine/encounters/battlefield-setup';

export interface BattleDeploy {
  setup: BattleSetupInput;
  zones: DeploymentZones;
  biome: BattlefieldBiome;
  place: string;
  approach: string;
  ambush: boolean;
  names: Record<string, string>;
}

export type BattleBatchSource = 'hero' | 'enemy';

const TASK_ACTIONS = new Set<BattleAction['kind']>(['answer-task', 'task-timeout']);

export const useBattleStore = defineStore('battle-store', () => {
  const deploy = shallowRef<BattleDeploy | null>(null);
  const battle = shallowRef<BattleState | null>(null);
  const localHeroIds = ref<string[]>([]);
  const lastHeroEvents = shallowRef<DomainEvent[]>([]);
  const turnStartWill = ref(0);
  const queue = shallowRef<DomainEvent[]>([]);

  const isOpen = computed(() => deploy.value !== null);
  const projection = computed(() =>
    battle.value ? projectBattleForViewer(battle.value, 'heroes') : null,
  );

  function absorb(next: BattleState | null, events: DomainEvent[]) {
    battle.value = next;
    for (const event of events) {
      if (event.type === 'TURN_STARTED')
        turnStartWill.value = (event.payload as { will: number }).will;
    }
    const visible = next ? events.map((e) => projectBattleEvent(next, e, 'heroes')) : events;
    queue.value = [...queue.value, ...visible];
  }

  function isLocalHero(id: string | undefined): boolean {
    return !!id && localHeroIds.value.includes(id);
  }

  function actorFor(action: BattleAction): string | null {
    const current = battle.value;
    if (!current) return null;
    if (TASK_ACTIONS.has(action.kind)) {
      const owner = current.task?.creatureId;
      return isLocalHero(owner) ? owner! : null;
    }
    return isLocalHero(current.activeId) ? current.activeId : null;
  }

  function send(command: BattleCommand): DomainEvent[] {
    const parsed = BattleCommandSchema.parse(command);
    const result = applyBattleCommand(battle.value ?? undefined, parsed);
    absorb(result.battle ?? null, result.events);
    return result.events;
  }

  function prepare(next: BattleDeploy, heroes: string[]) {
    deploy.value = next;
    localHeroIds.value = [...heroes];
    battle.value = null;
    lastHeroEvents.value = [];
    queue.value = [];
    turnStartWill.value = 0;
  }

  function start() {
    if (!deploy.value || battle.value) return;
    const result = startBattle(deploy.value.setup);
    absorb(result.battle, result.events);
  }

  function act(action: BattleAction, atMs: number = Date.now()): boolean {
    const heroId = actorFor(action);
    if (!heroId) return false;
    const events = send({ type: 'BATTLE', payload: { kind: 'hero', heroId, atMs, action } });
    lastHeroEvents.value = events;
    return !events.some((e) => e.type === 'BATTLE_REJECTED');
  }

  function actAll(actions: BattleAction[], atMs: number = Date.now()): boolean {
    const collected: DomainEvent[] = [];
    let accepted = actions.length > 0;
    for (const action of actions) {
      accepted = act(action, atMs);
      collected.push(...lastHeroEvents.value);
      if (!accepted || battle.value?.task) break;
    }
    lastHeroEvents.value = collected;
    return accepted;
  }

  const needsEnemyTurn = computed(() => {
    const current = battle.value;
    if (!current || current.phase === 'ended' || current.task) return false;
    return creatureById(current, current.activeId)?.side === 'enemies';
  });

  function runEnemyTurn(atMs: number = Date.now()) {
    if (!needsEnemyTurn.value) return;
    lastHeroEvents.value = [];
    send({ type: 'BATTLE', payload: { kind: 'run-enemy-turn', atMs } });
  }

  function takeEvents(): DomainEvent[] {
    const taken = queue.value;
    queue.value = [];
    return taken;
  }

  function close() {
    deploy.value = null;
    battle.value = null;
    localHeroIds.value = [];
    lastHeroEvents.value = [];
    queue.value = [];
    turnStartWill.value = 0;
  }

  return {
    deploy,
    battle,
    localHeroIds,
    lastHeroEvents,
    turnStartWill,
    queue,
    isOpen,
    projection,
    needsEnemyTurn,
    prepare,
    start,
    act,
    actAll,
    runEnemyTurn,
    takeEvents,
    close,
  };
});
