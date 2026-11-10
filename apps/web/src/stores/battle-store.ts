import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleHex, BattleSetupInput } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import type { BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import type { DeploymentZones } from '@hexoflat/engine/battle/battlefield-setup';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { BattleReply, BattleRequest } from '@/services/battle/battle-reply';

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

export interface BattleStep {
  battle: BattleProjection | null;
  events: DomainEvent[];
}

export interface BattleServerBridge {
  request(request: BattleRequest): Promise<BattleReply>;
  onStep(step: BattleStep): void;
  closed(reply: BattleReply): Promise<void>;
  restore(): Promise<BattleProjection | null>;
}

const REVEAL_MS = 2500;

const TASK_ACTIONS = new Set<BattleAction['kind']>(['answer-task', 'task-timeout']);

function animatesForeignCreature(
  events: DomainEvent[],
  isLocalHero: (id: string | undefined) => boolean,
): boolean {
  return events.some((event) => {
    const payload = event.payload as { creatureId?: string; attackerId?: string };
    if (event.type === 'CREATURE_MOVED') return !isLocalHero(payload.creatureId);
    if (event.type === 'STRIKE_LANDED') return !isLocalHero(payload.attackerId);
    return false;
  });
}

function burnedShieldsOf(events: DomainEvent[]): BattleHex[] | null {
  const resolved = [...events].reverse().find((e) => e.type === 'STRIKES_RESOLVED');
  if (!resolved) return null;
  const { burnedShields } = resolved.payload as { burnedShields: BattleHex[] };
  return burnedShields.map((hex) => ({ q: hex.q, r: hex.r }));
}

function actorFor(
  current: BattleProjection | null,
  action: BattleAction,
  isLocalHero: (id: string | undefined) => boolean,
): string | null {
  if (!current) return null;
  const owner = TASK_ACTIONS.has(action.kind) ? current.task?.creatureId : current.activeId;
  return isLocalHero(owner) ? owner! : null;
}

function noBridgeReply(): BattleReply {
  return { ok: false, code: 'NO_BATTLE', steps: [], events: [], closed: false, result: null };
}

export function createBattleStore(id: string) {
  return defineStore(id, () => {
    let bridge: BattleServerBridge | null = null;
    const deploy = shallowRef<BattleDeploy | null>(null);
    const engagement = shallowRef<Engagement | null>(null);
    const projection = shallowRef<BattleProjection | null>(null);
    const localHeroIds = ref<string[]>([]);
    const lastHeroEvents = shallowRef<DomainEvent[]>([]);
    const turnStartWill = ref(0);
    const queue = shallowRef<DomainEvent[]>([]);
    const animating = ref(false);
    const enemyTurnPlaying = ref(false);
    const waiting = ref(false);
    const connectionLost = ref(false);
    const refusedEnemyTurn = shallowRef<BattleProjection | null>(null);
    const revealedShields = shallowRef<BattleHex[]>([]);
    let revealTimer: ReturnType<typeof setTimeout> | null = null;

    const inputLocked = computed(() => animating.value && enemyTurnPlaying.value);
    const isOpen = computed(() => deploy.value !== null);
    const inBattle = computed(() => engagement.value !== null || deploy.value !== null);

    function isLocalHero(id: string | undefined): boolean {
      return !!id && localHeroIds.value.includes(id);
    }

    function revealShields(events: DomainEvent[]) {
      const burned = burnedShieldsOf(events);
      if (!burned) return;
      if (revealTimer) clearTimeout(revealTimer);
      revealedShields.value = burned;
      revealTimer = setTimeout(() => {
        revealedShields.value = [];
        revealTimer = null;
      }, REVEAL_MS);
    }

    function absorb(next: BattleProjection | null, events: DomainEvent[]) {
      projection.value = next;
      revealShields(events);
      if (animatesForeignCreature(events, isLocalHero)) enemyTurnPlaying.value = true;
      for (const event of events) {
        if (event.type === 'TURN_STARTED')
          turnStartWill.value = (event.payload as { will: number }).will;
      }
      queue.value = [...queue.value, ...events];
    }

    async function run(request: BattleRequest): Promise<BattleReply> {
      const current = bridge;
      if (!current) return noBridgeReply();
      waiting.value = true;
      let reply: BattleReply;
      try {
        reply = await current.request(request);
      } finally {
        waiting.value = false;
      }
      connectionLost.value = reply.code === 'CONNECTION_LOST';
      for (const step of reply.steps) {
        absorb(step.battle, step.events);
        current.onStep(step);
      }
      if (reply.closed) await current.closed(reply);
      return reply;
    }

    function prepare(
      next: BattleDeploy,
      heroes: string[],
      resumed: BattleProjection | null = null,
    ) {
      deploy.value = next;
      localHeroIds.value = [...heroes];
      projection.value = resumed;
      lastHeroEvents.value = [];
      queue.value = [];
      turnStartWill.value = resumed?.turnWill ?? 0;
    }

    async function start(): Promise<boolean> {
      if (!deploy.value || projection.value || waiting.value) return false;
      const reply = await run({ kind: 'start' });
      if (reply.ok) return true;
      if (reply.code !== 'BATTLE_OPEN' || !bridge) return false;
      const view = await bridge.restore();
      if (!view) return false;
      projection.value = view;
      turnStartWill.value = view.turnWill;
      return true;
    }

    function bindBridge(next: BattleServerBridge | null) {
      bridge = next;
    }

    function engage(next: Engagement | null) {
      engagement.value = next;
    }

    function restore(saved: Engagement | null, view: BattleProjection | null) {
      close();
      engagement.value = saved;
      projection.value = saved ? view : null;
    }

    async function leave(): Promise<boolean> {
      if (!projection.value?.outcome) return false;
      const reply = await run({ kind: 'close' });
      return reply.ok;
    }

    async function act(action: BattleAction): Promise<boolean> {
      if (waiting.value) return false;
      if (inputLocked.value && !TASK_ACTIONS.has(action.kind)) return false;
      if (!animating.value) enemyTurnPlaying.value = false;
      if (!actorFor(projection.value, action, isLocalHero)) return false;
      const reply = await run({ kind: 'hero', action });
      lastHeroEvents.value = reply.events;
      return reply.ok && !reply.events.some((e) => e.type === 'BATTLE_REJECTED');
    }

    async function actAll(actions: BattleAction[]): Promise<boolean> {
      const collected: DomainEvent[] = [];
      let accepted = actions.length > 0;
      for (const action of actions) {
        accepted = await act(action);
        collected.push(...lastHeroEvents.value);
        if (!accepted || projection.value?.task) break;
      }
      lastHeroEvents.value = collected;
      return accepted;
    }

    const needsEnemyTurn = computed(() => {
      const current = projection.value;
      if (!current || current.phase === 'ended' || current.task) return false;
      if (current.reaction?.stage === 'block') return false;
      if (animating.value || waiting.value || refusedEnemyTurn.value === current) return false;
      return current.creatures.find((c) => c.id === current.activeId)?.side === 'enemies';
    });

    async function runEnemyTurn(): Promise<void> {
      if (!needsEnemyTurn.value) return;
      const before = projection.value;
      lastHeroEvents.value = [];
      enemyTurnPlaying.value = true;
      const reply = await run({ kind: 'run-enemy-turn' });
      if (reply.ok || projection.value !== before) return;
      refusedEnemyTurn.value = before;
      if (!animating.value) enemyTurnPlaying.value = false;
    }

    function takeEvents(): DomainEvent[] {
      const taken = queue.value;
      queue.value = [];
      return taken;
    }

    function setAnimating(busy: boolean) {
      animating.value = busy;
      if (!busy) enemyTurnPlaying.value = false;
    }

    function close() {
      if (revealTimer) clearTimeout(revealTimer);
      revealTimer = null;
      revealedShields.value = [];
      animating.value = false;
      enemyTurnPlaying.value = false;
      waiting.value = false;
      connectionLost.value = false;
      refusedEnemyTurn.value = null;
      deploy.value = null;
      engagement.value = null;
      projection.value = null;
      localHeroIds.value = [];
      lastHeroEvents.value = [];
      queue.value = [];
      turnStartWill.value = 0;
    }

    return {
      deploy,
      engagement,
      projection,
      localHeroIds,
      lastHeroEvents,
      turnStartWill,
      queue,
      animating,
      waiting,
      connectionLost,
      inputLocked,
      revealedShields,
      isOpen,
      inBattle,
      needsEnemyTurn,
      prepare,
      start,
      act,
      actAll,
      runEnemyTurn,
      takeEvents,
      setAnimating,
      close,
      leave,
      bindBridge,
      engage,
      restore,
    };
  });
}

export const useBattleStore = createBattleStore('battle-store');

export type BattleStoreInstance = ReturnType<typeof useBattleStore>;
