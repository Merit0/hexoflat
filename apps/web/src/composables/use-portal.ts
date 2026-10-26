import { applyCommand } from '@hexoflat/engine';
import type { HexEngineState } from '@hexoflat/engine';
import { findFreeHexNear } from '@hexoflat/engine/map/free-hex-finder';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { planPortalOpening, returnScrollWillCost } from '@hexoflat/engine/portal/portal-rules';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { PortalLink } from '@hexoflat/engine/portal/portal-state';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import {
  findPortalSpot,
  placeReturnPortal,
  portalClosedEvents,
  portalLocation,
} from '@/services/world/portal-service';
import { playPortalEnter, playPortalExit, portalFxBusy, releasePortalFx } from '@/render/portal-fx';
import { routeToLocation } from '@/services/world/location-navigator';
import { transactKnowledge } from '@/services/persistence/knowledge-storage';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;

export type PortalOpenPreview =
  { ok: true; oneWay: boolean; cost: number } | { ok: false; reason: string };

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
  const combatStore = useCombatStore();

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
      combatStore.combatActive,
    );
    if (!plan.ok) return { ok: false, reason: plan.reason };
    if (inventoryStore.countItem(SCROLL) < 1) {
      return { ok: false, reason: 'NO_SCROLL' };
    }
    const cost = returnScrollWillCost();
    if ((heroStore.knowledge?.current ?? 0) < cost) {
      return { ok: false, reason: 'INSUFFICIENT_WILL' };
    }
    return { ok: true, oneWay: plan.link.campHex === null, cost };
  }

  async function openPortal(target: IHexCoordinates): Promise<PortalOutcome> {
    if (portalFxBusy.value) return { ok: false };
    const state = engineState();
    if (!state || heroStore.knowledgeError) {
      return { ok: false, reason: 'NO_LOCATION' };
    }
    const hero = Object.values(state.heroes)[0];
    const heroId = hero.id;
    const ctx = worldStore.buildEngineContext();
    let reason = 'NO_LOCATION';
    let opened = false;

    const knowledge = await transactKnowledge(heroId, (current) => {
      const { events } = applyCommand(
        { ...state, knowledge: current },
        { type: 'OPEN_PORTAL', payload: { heroId, target } },
        ctx,
      );
      opened = events.some((event) => event.type === 'PORTAL_OPENED');
      const rejected = events.find((event) => event.type === 'PORTAL_OPEN_REJECTED');
      if (rejected) reason = (rejected.payload as { reason: string }).reason;
      return opened;
    });

    if (!opened) return { ok: false, reason };

    heroStore.knowledge = knowledge;
    heroStore.setPortal(hero.portal ?? null);
    worldStore.markTileDirty(target);
    worldStore.saveToStorage();
    useGameEventsStore().push(heroStore.hero.name, 'opened a portal', 'MAP');
    heroToolStore.stopTool();
    return { ok: true };
  }

  function placeCampPortal(campHex: IHexCoordinates): IHexCoordinates | null {
    const map = worldStore.map as HexMapModel | null;
    if (!map) return null;
    const spot = findPortalSpot(
      map,
      campHex,
      heroStore.heroCoordinates ? [heroStore.heroCoordinates] : [],
    );
    if (!spot || !placeReturnPortal(map, spot)) return null;
    worldStore.markTileDirty(spot);
    return spot;
  }

  function standBeside(anchor: IHexCoordinates | null) {
    const map = worldStore.map as HexMapModel | null;
    if (!map || !anchor) return;
    const spot = findFreeHexNear(map, anchor);
    if (!spot) return;
    heroStore.heroCoordinates = spot;
    if (worldStore.currentMapId) heroStore.rememberPosition(worldStore.currentMapId, spot);
  }

  async function enterPortal(): Promise<PortalOutcome> {
    if (portalFxBusy.value) return { ok: false };
    const state = engineState();
    if (!state) return { ok: false, reason: 'NO_LOCATION' };
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
    const closures = portalClosedEvents(events);
    const portalHex = (entered.payload as { portalHex: IHexCoordinates }).portalHex;
    try {
      await playPortalEnter(portalHex);
      return await travel(destination, closures, hero.portal ?? null);
    } finally {
      releasePortalFx();
    }
  }

  async function travel(
    destination: PortalEnteredPayload,
    closures: ReturnType<typeof portalClosedEvents>,
    nextPortal: PortalLink | null,
  ): Promise<PortalOutcome> {
    heroStore.setPortal(nextPortal);
    heroStore.applyPortalClosures(closures);
    worldStore.goToLocation(destination.to, destination.toMapId ?? undefined);

    let anchor = destination.arrivalNear;
    const link = heroStore.portal;
    if (!closures.length && link?.campHex) {
      const spot = placeCampPortal(link.campHex);
      if (spot) {
        anchor = spot;
        heroStore.setPortal({ ...link, campHex: spot });
      }
    }
    standBeside(anchor);
    worldStore.revealAroundHero();
    worldStore.markAllTilesDirty();
    worldStore.saveToStorage();
    await routeToLocation(destination.to);
    if (anchor) await playPortalExit(anchor);
    return { ok: true };
  }

  return { previewOpen, openPortal, enterPortal };
}
