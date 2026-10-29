import { applyCommand, type HexEngineState } from '@hexoflat/engine';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { BattleCommand } from '@hexoflat/engine/battle/battle-commands';
import type { EncounterAction } from '@hexoflat/engine/encounters/encounter-commands';
import {
  planEncounterBattle,
  type HeroBattleSummary,
} from '@hexoflat/engine/encounters/encounter-battle';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { i18n } from '@/i18n';
import { compassOf, heroCreatureFrom, type LoadoutSource } from './encounter-loadout';
import { useBattleStore, type BattleStep } from '@/stores/battle-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useGameEventsStore } from '@/stores/game-events-store';

interface ClosedPayload {
  outcome: 'victory' | 'defeat';
  heroes: HeroBattleSummary[];
  kills: number;
}

export interface EncounterFlowHooks {
  onBattleRequested(): void;
}

export function useEncounterFlow(hooks: EncounterFlowHooks) {
  const world = useWorldMapStore();
  const heroStore = useHeroStore();
  const battleStore = useBattleStore();
  const inventory = useHeroInventoryStore();
  const t = i18n.global.t;

  function loadoutSource(): LoadoutSource {
    return {
      heroId: heroStore.hero.id,
      hearts: heroStore.hero.currentHealth,
      weapon: inventory.equippedItems.weapon,
      shield: inventory.equippedItems.shield,
      items: inventory.items,
    };
  }

  function engineState(map: HexMapModel): HexEngineState {
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

  function command(action: EncounterAction) {
    return {
      type: 'ENCOUNTER' as const,
      payload: { heroId: heroStore.hero.id, atMs: Date.now(), action },
    };
  }

  function runSync(action: EncounterAction): { state: HexEngineState; events: DomainEvent[] } {
    const state = engineState(world.map as HexMapModel);
    const { events } = applyCommand(state, command(action), world.buildEngineContext());
    return { state, events };
  }

  function absorb(state: HexEngineState, events: DomainEvent[]) {
    battleStore.engage(state.engagement ?? null);
    for (const event of events) applyEvent(state, event);
    world.markAllTilesDirty();
    world.saveToStorage();
  }

  function applyEvent(state: HexEngineState, event: DomainEvent) {
    const log = useGameEventsStore();
    const name = heroStore.hero.name || 'Hero';
    const payload = event.payload as Record<string, unknown>;
    switch (event.type) {
      case 'ENCOUNTER_REJECTED':
        useHeroToolStore().setActionMessage(t(`encounter.rejected.${String(payload.reason)}`));
        return;
      case 'ENCOUNTER_SCOUTED':
        log.push(name, t('encounter.log.scouted'), 'BATTLE');
        return;
      case 'AMBUSH':
        log.push(name, t('encounter.log.ambush'), 'BATTLE');
        return;
      case 'BATTLE_REQUESTED':
        hooks.onBattleRequested();
        prepareDeploy();
        return;
      case 'SNEAK_SUCCEEDED':
        moveHero(state, payload.to as IHexCoordinates | null);
        log.push(
          name,
          t(payload.to ? 'encounter.log.sneaked' : 'encounter.log.sneakBlocked'),
          'MAP',
        );
        return;
      case 'LOOT_PICKED':
        for (const key of payload.items as THexobjectKey[]) inventory.putToInventory(key);
        log.push(name, t('encounter.log.looted'), 'LOOT');
        return;
      case 'BATTLE_CLOSED':
        closeOut(payload as unknown as ClosedPayload);
        return;
      default:
        return;
    }
  }

  function moveHero(state: HexEngineState, to: IHexCoordinates | null) {
    if (!to) return;
    heroStore.heroCoordinates = { ...state.heroes[heroStore.hero.id].coordinates };
    if (world.currentMapId)
      heroStore.rememberPosition(world.currentMapId, heroStore.heroCoordinates);
    world.revealAroundHero();
  }

  function closeOut(closed: ClosedPayload) {
    const mine = closed.heroes.find((h) => h.id === heroStore.hero.id);
    if (mine) {
      heroStore.hero.setHealth(mine.hearts);
      for (const key of mine.consumed) inventory.takeFromInventory(key as THexobjectKey, 1);
    }
    for (let i = 0; i < closed.kills; i += 1) heroStore.hero.addKilled();
    heroStore.saveProgressToStorage();
    battleStore.close();
    if (closed.outcome === 'defeat') void world.respawnHeroAtCamping();
  }

  function prepareDeploy() {
    const engagement = battleStore.engagement;
    const map = world.map as HexMapModel | null;
    if (!engagement || !map || battleStore.deploy) return;
    const hero = heroCreatureFrom(loadoutSource());
    const plan = planEncounterBattle(map, engagement, [hero]);
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

  function bridgeStep(state: HexEngineState, events: DomainEvent[]): BattleStep {
    battleStore.engage(state.engagement ?? null);
    return { battle: state.battle ?? null, events };
  }

  function bindBattleBridge() {
    battleStore.bindBridge({
      send(battleCommand: BattleCommand) {
        const state = engineState(world.map as HexMapModel);
        const { events } = applyCommand(state, battleCommand, world.buildEngineContext());
        return bridgeStep(state, events);
      },
      start() {
        const { state, events } = runSync({
          kind: 'start-battle',
          heroes: [heroCreatureFrom(loadoutSource())],
        });
        return bridgeStep(state, events);
      },
      leave() {
        if (!battleStore.battle?.outcome) return;
        const { state, events } = runSync({ kind: 'close-battle' });
        absorb(state, events);
      },
    });
  }

  return {
    loadoutSource,
    engineState,
    command,
    runSync,
    absorb,
    prepareDeploy,
    bindBattleBridge,
  };
}
