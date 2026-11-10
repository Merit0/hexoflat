import { watch } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { planSquadBattle } from '@hexoflat/engine/squads/squad-battle';
import { findSquad } from '@hexoflat/engine/squads/squad-state';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { i18n } from '@/i18n';
import { compassOf, heroCreatureFrom, type LoadoutSource } from './squad-loadout';
import { useBattleStore } from '@/stores/battle-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { logBattleEvents } from '@/services/battle/battle-event-log';
import { bindBattleHandsGate } from '@/services/battle/battle-hands-gate';
import {
  loadServerBattleView,
  sendBattle,
  type BattleReply,
} from '@/services/battle/battle-server';
import { useBattleWarnings } from '@/composables/use-battle-warnings';
import { closeHeroOverlays } from './close-hero-overlays';

export function squadLoadoutSource(): LoadoutSource {
  const heroStore = useHeroStore();
  return {
    heroId: heroStore.hero.id,
    hearts: heroStore.hero.currentHealth,
    maxHearts: heroStore.heroHpMax,
  };
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
    default:
      return null;
  }
}

export function applySquadEvents(events: DomainEvent[]): string | null {
  let rejection: string | null = null;
  for (const event of events) rejection = applySquadEvent(event) ?? rejection;
  const world = useWorldMapStore();
  world.markAllTilesDirty();
  return rejection;
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
    battleStore.projection,
  );
  battleStore.engage(engagement);
}

async function settleClosed(reply: BattleReply): Promise<void> {
  const world = useWorldMapStore();
  const battleStore = useBattleStore();
  const closed = reply.events.find((event) => event.type === 'BATTLE_CLOSED');
  const outcome = (closed?.payload as { outcome?: string } | undefined)?.outcome;
  const result = reply.result;
  closeHeroOverlays();
  if (outcome === 'defeat' && result?.travel) {
    await world.respawnHeroAtCamping(result);
    return;
  }
  if (result) world.applyWorldResult(result);
  battleStore.close();
}

function bindBattleBridge() {
  useBattleStore().bindBridge({
    request: sendBattle,
    onStep(step) {
      logBattleEvents(step.events, step.battle);
    },
    closed: settleClosed,
    restore: loadServerBattleView,
  });
}

export function useSquadFlow() {
  const world = useWorldMapStore();
  const battleStore = useBattleStore();

  bindBattleBridge();
  bindBattleHandsGate(useBattleWarnings());

  watch(
    () => battleStore.projection?.outcome,
    (outcome) => {
      if (outcome === 'defeat') closeHeroOverlays();
    },
  );

  watch(
    () => [battleStore.engagement, battleStore.deploy, world.map] as const,
    () => {
      if (battleStore.engagement && !battleStore.deploy) prepareDeploy();
      if (battleStore.deploy && !battleStore.projection) void battleStore.start();
    },
    { immediate: true },
  );
}
