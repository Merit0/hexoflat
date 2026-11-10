import { applyCommand } from '@hexoflat/engine';
import type { HexEngineState } from '@hexoflat/engine';
import { findFreeHexNear } from '@hexoflat/engine/map/free-hex-finder';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { planPortalOpening, resolvePortalCost } from '@hexoflat/engine/portal/portal-rules';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { PortalLink } from '@hexoflat/engine/portal/portal-state';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { portalLocation } from '@/services/world/portal-service';
import { installTravelledWorlds, portalCommandOnServer } from '@/services/world/served-world';
import { playPortalEnter, playPortalExit, portalFxBusy, releasePortalFx } from '@/render/portal-fx';
import { routeToLocation } from '@/services/world/location-navigator';
import { inventorySession } from '@/services/inventory/inventory-session';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;

export type PortalOpenPreview =
  { ok: true; oneWay: boolean; cost: number } | { ok: false; reason: string; cost?: number };

export interface PortalOutcome {
  ok: boolean;
  reason?: string;
}

interface PortalEnteredPayload {
  to: LocationKey;
  toMapId: string | null;
  arrivalNear: IHexCoordinates | null;
}

export function usePortal() {
  const heroStore = useHeroStore();
  const worldStore = useWorldMapStore();
  const inventoryStore = useHeroInventoryStore();
  const heroToolStore = useHeroToolStore();
  const battleStore = useBattleStore();

  function engineState(): HexEngineState | null {
    const map = worldStore.map as HexMapModel | null;
    const position = heroStore.heroCoordinates;
    if (!map || !position) return null;
    const hero = heroStore.engineHeroState(position);
    return {
      map,
      heroes: { [hero.id]: hero },
      location: portalLocation(worldStore.currentLocationKey, worldStore.currentMapId),
    };
  }

  function previewOpen(target: IHexCoordinates): PortalOpenPreview {
    const state = engineState();
    if (!state) return { ok: false, reason: 'NO_LOCATION' };
    const hero = Object.values(state.heroes)[0];
    const plan = planPortalOpening(
      state.map,
      hero,
      state.heroes,
      target,
      state.location!,
      battleStore.inBattle,
    );
    if (!plan.ok) return { ok: false, reason: plan.reason };
    const priced = resolvePortalCost(heroStore.knowledge?.skills, inventoryStore.countItem(SCROLL));
    if (!priced.ok) return { ok: false, reason: priced.reason };
    const { cost } = priced;
    if ((heroStore.knowledge?.current ?? 0) < cost) {
      return { ok: false, reason: 'INSUFFICIENT_WILL', cost };
    }
    return { ok: true, oneWay: plan.link.campHex === null, cost };
  }

  function currentPlace() {
    const from = heroStore.heroCoordinates;
    if (!worldStore.map || !worldStore.currentMapId || !from) return null;
    return {
      locationKey: worldStore.currentLocationKey,
      mapId: worldStore.currentMapId,
      from: { ...from },
    };
  }

  async function openPortal(target: IHexCoordinates): Promise<PortalOutcome> {
    if (portalFxBusy.value) return { ok: false };
    const at = currentPlace();
    if (!at || heroStore.knowledgeError) return { ok: false, reason: 'NO_LOCATION' };
    const result = await portalCommandOnServer(at, 'WORLD_PORTAL_OPEN', { target });
    if (!result.ok) return { ok: false, reason: result.code ?? 'NO_LOCATION' };
    worldStore.applyWorldResult(result);
    heroStore.knowledge = inventorySession.knowledge;
    worldStore.cacheServedWorld();
    useGameEventsStore().push(heroStore.hero.name, 'opened a portal', 'MAP');
    heroToolStore.stopTool();
    return { ok: true };
  }

  async function enterPortal(): Promise<PortalOutcome> {
    if (portalFxBusy.value) return { ok: false };
    const state = engineState();
    const at = currentPlace();
    if (!state || !at) return { ok: false, reason: 'NO_LOCATION' };
    const hero = Object.values(state.heroes)[0];
    const { events } = applyCommand(
      state,
      { type: 'ENTER_PORTAL', payload: { heroId: hero.id } },
      worldStore.buildEngineContext(),
    );
    const entered = events.find((event) => event.type === 'PORTAL_ENTERED');
    if (!entered) {
      const rejected = events.find((event) => event.type === 'PORTAL_ENTER_REJECTED');
      const reason = (rejected?.payload as { reason?: string } | undefined)?.reason ?? 'NO_PORTAL';
      return { ok: false, reason };
    }

    heroToolStore.stopTool();
    const destination = entered.payload as PortalEnteredPayload;
    const portalHex = (entered.payload as { portalHex: IHexCoordinates }).portalHex;
    try {
      await playPortalEnter(portalHex);
      const result = await portalCommandOnServer(at, 'WORLD_PORTAL_ENTER');
      if (!result.ok) return { ok: false, reason: result.code ?? 'NO_PORTAL' };
      installTravelledWorlds(result);
      worldStore.goToLocation(destination.to);
      await routeToLocation(destination.to);
      const anchor = inventorySession.portal?.campHex ?? destination.arrivalNear;
      if (anchor) await playPortalExit(anchor);
      return { ok: true };
    } finally {
      releasePortalFx();
    }
  }

  return { previewOpen, openPortal, enterPortal };
}
