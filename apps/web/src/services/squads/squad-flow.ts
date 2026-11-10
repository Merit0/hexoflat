import { watch } from 'vue';
import { applyCommand, type HexEngineState } from '@hexoflat/engine';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { BattleCommand, SquadLifecyclePayload } from '@hexoflat/engine/battle/battle-commands';
import type { BattleState } from '@hexoflat/engine/battle/battle-state';
import { planSquadBattle, type HeroBattleSummary } from '@hexoflat/engine/squads/squad-battle';
import { findSquad } from '@hexoflat/engine/squads/squad-state';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { i18n } from '@/i18n';
import { compassOf, heroCreatureFrom, type LoadoutSource } from './squad-loadout';
import { useBattleStore, type BattleStep } from '@/stores/battle-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { withStoreInventory } from '@/services/inventory/inventory-bridge';
import { useGameEventsStore } from '@/stores/game-events-store';
import { logBattleEvents } from '@/services/battle/battle-event-log';
import { bindBattleHandsGate } from '@/services/battle/battle-hands-gate';
import { useBattleWarnings } from '@/composables/use-battle-warnings';

interface ClosedPayload {
  outcome: 'victory' | 'defeat';
  heroes: HeroBattleSummary[];
  kills: number;
}

type LifecycleInput = SquadLifecyclePayload extends infer P
  ? P extends SquadLifecyclePayload
    ? Omit<P, 'heroId' | 'atMs'>
    : never
  : never;

export function squadLoadoutSource(): LoadoutSource {
  const heroStore = useHeroStore();
  return {
    heroId: heroStore.hero.id,
    hearts: heroStore.hero.currentHealth,
    maxHearts: heroStore.heroHpMax,
  };
}

function engineState(map: HexMapModel): HexEngineState {
  const heroStore = useHeroStore();
  const battleStore = useBattleStore();
  return {
    map,
    heroes: {
      [heroStore.hero.id]: heroStore.engineHeroState(
        heroStore.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 },
      ),
    },
    knowledge: heroStore.knowledge ?? undefined,
    battle: battleStore.battle ?? undefined,
    engagement: battleStore.engagement ?? undefined,
  };
}

function closeOut(closed: ClosedPayload) {
  const world = useWorldMapStore();
  const heroStore = useHeroStore();
  const mine = closed.heroes.find((h) => h.id === heroStore.hero.id);
  if (mine) {
    heroStore.reportHealth(mine.hearts);
  }
  for (let i = 0; i < closed.kills; i += 1) heroStore.hero.addKilled();
  heroStore.saveProgressToStorage();
  useBattleStore().close();
  if (closed.outcome === 'defeat') void world.respawnHeroAtCamping();
}

function applySquadEvent(event: DomainEvent): string | null {
  const t = i18n.global.t;
  const log = useGameEventsStore();
  const name = useHeroStore().hero.name || 'Hero';
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'SQUAD_REJECTED':
      return t(`squad.rejected.${String(payload.reason)}`);
    case 'SQUAD_SCOUTED':
      log.push(name, t('squad.log.scouted'), 'BATTLE');
      return null;
    case 'AMBUSH':
      log.push(name, t('squad.log.ambush'), 'BATTLE');
      return null;
    case 'BATTLE_CLOSED':
      closeOut(payload as unknown as ClosedPayload);
      return null;
    default:
      return null;
  }
}

export function applySquadEvents(events: DomainEvent[]): string | null {
  let rejection: string | null = null;
  for (const event of events) rejection = applySquadEvent(event) ?? rejection;
  const world = useWorldMapStore();
  world.markAllTilesDirty();
  world.saveToStorage();
  return rejection;
}

function runLifecycle(input: LifecycleInput): { state: HexEngineState; events: DomainEvent[] } {
  const world = useWorldMapStore();
  const state = engineState(world.map as HexMapModel);
  const payload = { heroId: useHeroStore().hero.id, atMs: Date.now(), ...input };
  const { events } = withStoreInventory(payload.heroId, state, (bound) =>
    applyCommand(bound, { type: 'BATTLE', payload }, world.buildEngineContext()),
  );
  useBattleStore().engage(state.engagement ?? null);
  return { state, events };
}

function prepareDeploy() {
  const world = useWorldMapStore();
  const heroStore = useHeroStore();
  const battleStore = useBattleStore();
  const engagement = battleStore.engagement;
  const map = world.map as HexMapModel | null;
  if (!engagement || !map || battleStore.deploy || !findSquad(map, engagement.squadId)) return;
  const hero = heroCreatureFrom(squadLoadoutSource());
  const plan = planSquadBattle(map, engagement, [hero]);
  battleStore.prepare(
    {
      setup: plan.deployment.setup,
      zones: plan.deployment.zones,
      biome: plan.field.biome,
      place: MapRegistry.get(world.currentLocationKey)?.title ?? world.currentLocationKey,
      approach: compassOf(plan.direction),
      ambush: engagement.ambush,
      names: { [hero.id]: heroStore.hero.name || 'Hero' },
    },
    [hero.id],
    battleStore.battle,
  );
  battleStore.engage(engagement);
}

function followBattleHealth(battle: BattleState | null | undefined): void {
  const heroStore = useHeroStore();
  const hero = battle?.creatures.find((creature) => creature.id === heroStore.hero.id);
  if (!hero || heroStore.hero.currentHealth === hero.hp / 2) return;
  heroStore.reportHealth(hero.hp / 2);
}

function bridgeStep(state: HexEngineState, events: DomainEvent[]): BattleStep {
  useBattleStore().engage(state.engagement ?? null);
  followBattleHealth(state.battle);
  logBattleEvents(events, state.battle ?? null);
  return { battle: state.battle ?? null, events };
}

function bindBattleBridge() {
  const world = useWorldMapStore();
  const battleStore = useBattleStore();
  battleStore.bindBridge({
    send(battleCommand: BattleCommand) {
      const state = engineState(world.map as HexMapModel);
      const { events } = applyCommand(state, battleCommand, world.buildEngineContext());
      return bridgeStep(state, events);
    },
    start() {
      const { state, events } = runLifecycle({
        kind: 'start',
        heroes: [heroCreatureFrom(squadLoadoutSource())],
      });
      return bridgeStep(state, events);
    },
    leave() {
      if (!battleStore.battle?.outcome) return;
      applySquadEvents(runLifecycle({ kind: 'close' }).events);
    },
  });
}

export function useSquadFlow() {
  const world = useWorldMapStore();
  const battleStore = useBattleStore();

  bindBattleBridge();
  bindBattleHandsGate(useBattleWarnings());

  watch(
    () => [battleStore.engagement, battleStore.deploy, world.map] as const,
    () => {
      if (battleStore.engagement && !battleStore.deploy) prepareDeploy();
      if (battleStore.deploy && !battleStore.battle) battleStore.start();
    },
    { immediate: true },
  );
}
