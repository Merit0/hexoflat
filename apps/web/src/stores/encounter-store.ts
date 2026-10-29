import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { EncounterAction } from '@hexoflat/engine/encounters/encounter-commands';
import {
  findEncounter,
  isAdjacent,
  projectEncounters,
  sentryWatchedHexes,
  type EncounterView,
} from '@hexoflat/engine/encounters/encounter-state';
import { i18n } from '@/i18n';
import { dispatchEncounter } from '@/services/knowledge/knowledge-controller';
import { heroThreatProfile } from '@/services/encounters/encounter-loadout';
import { useEncounterFlow } from '@/services/encounters/encounter-flow';
import { taskQuestionText, type BattleTaskView } from '@/composables/battle-view';
import { useBattleStore } from '@/stores/battle-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';

const WILL_ACTIONS = new Set<EncounterAction['kind']>(['attack', 'scout']);

function isRevealed(map: HexMapModel, coord: IHexCoordinates): boolean {
  return !!map.tiles.find(
    (t) =>
      t.coordinates.columnIndex === coord.columnIndex && t.coordinates.rowIndex === coord.rowIndex,
  )?.isRevealed;
}

export const useEncounterStore = defineStore('encounter-store', () => {
  const world = useWorldMapStore();
  const heroStore = useHeroStore();
  const battleStore = useBattleStore();
  const t = i18n.global.t;
  const selectedId = ref<string | null>(null);
  const busy = ref(false);
  const flow = useEncounterFlow({ onBattleRequested: () => (selectedId.value = null) });

  function currentMap(): HexMapModel | null {
    void world.dirtyTick;
    return world.map as HexMapModel | null;
  }

  const views = computed<EncounterView[]>(() => {
    const map = currentMap();
    return map ? projectEncounters(map, heroThreatProfile(flow.loadoutSource())) : [];
  });

  const watched = computed<IHexCoordinates[]>(() => {
    const map = currentMap();
    return map ? sentryWatchedHexes(map).filter((c) => isRevealed(map, c)) : [];
  });

  const reachableIds = computed(() => {
    const at = heroStore.heroCoordinates;
    if (!at || battleStore.inBattle) return [];
    return views.value.filter((v) => isAdjacent(v.coordinates, at)).map((v) => v.id);
  });

  const selected = computed(() => views.value.find((v) => v.id === selectedId.value) ?? null);
  const canAct = computed(
    () => !!selected.value && reachableIds.value.includes(selected.value.id) && !busy.value,
  );

  const sneak = computed<(BattleTaskView & { encounterId: string }) | null>(() => {
    const map = currentMap();
    for (const view of views.value) {
      const task = map ? findEncounter(map, view.id)?.encounter.sneak : undefined;
      if (task?.heroId !== heroStore.hero.id) continue;
      return {
        encounterId: view.id,
        kind: 'sneak',
        question: taskQuestionText(task.question),
        options: task.options,
        issuedAtMs: task.issuedAtMs,
        deadlineMs: task.deadlineMs,
      };
    }
    return null;
  });

  const layer = computed(() => ({
    encounters: views.value,
    watched: watched.value,
    reachableIds: reachableIds.value,
  }));

  async function run(action: EncounterAction): Promise<DomainEvent[]> {
    const map = world.map as HexMapModel | null;
    if (!map || busy.value) return [];
    busy.value = true;
    try {
      if (!WILL_ACTIONS.has(action.kind)) {
        const { state, events } = flow.runSync(action);
        flow.absorb(state, events);
        return events;
      }
      const held = { battle: battleStore.battle ?? undefined, engagement: undefined };
      const host = heroStore.knowledgeHost(world);
      const result = await dispatchEncounter(host, flow.command(action), held);
      heroStore.knowledge = result.state;
      flow.absorb(
        { ...flow.engineState(map), ...result.held, heroes: { [result.hero.id]: result.hero } },
        result.events,
      );
      return result.events;
    } finally {
      busy.value = false;
    }
  }

  flow.bindBattleBridge();

  watch(
    () => [battleStore.engagement, battleStore.deploy, world.map] as const,
    () => {
      if (battleStore.engagement && !battleStore.deploy) flow.prepareDeploy();
    },
    { immediate: true },
  );

  function select(id: string | null) {
    selectedId.value = id;
  }

  function tapEncounter(id: string): boolean {
    const view = views.value.find((v) => v.id === id);
    if (!view) return false;
    if (!reachableIds.value.includes(id)) {
      useGameEventsStore().push(
        heroStore.hero.name || 'Hero',
        t('encounter.comeCloser', { name: t(view.title) }),
        'MAP',
      );
      return true;
    }
    if (view.status === 'loot') {
      void run({ kind: 'pickup-loot', encounterId: id });
      return true;
    }
    select(id);
    return true;
  }

  return {
    selectedId,
    busy,
    views,
    watched,
    reachableIds,
    selected,
    canAct,
    sneak,
    layer,
    select,
    tapEncounter,
    attack: (id: string) => run({ kind: 'attack', encounterId: id }),
    scout: (id: string) => run({ kind: 'scout', encounterId: id }),
    startSneak: (id: string) => run({ kind: 'start-sneak', encounterId: id }),
    answerSneak: (id: string, option: number) =>
      run({ kind: 'answer-sneak', encounterId: id, option }),
    sneakTimeout: (id: string) => run({ kind: 'sneak-timeout', encounterId: id }),
  };
});
