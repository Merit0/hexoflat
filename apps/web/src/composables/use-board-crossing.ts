import { applyCommand } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { BoardCrossing } from '@hexoflat/engine/hero-movement/board-crossing';
import { portalClosedEvents, portalLocation } from '@/services/world/portal-service';
import { routeToLocation } from '@/services/world/location-navigator';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';

export async function crossExitIfStanding(): Promise<boolean> {
  const worldStore = useWorldMapStore();
  const heroStore = useHeroStore();
  const map = worldStore.map as HexMapModel | null;
  const position = heroStore.heroCoordinates;
  if (!map || !position) return false;

  const hero = heroStore.engineHeroState(position);
  const { events } = applyCommand(
    {
      map,
      heroes: { [hero.id]: hero },
      location: portalLocation(worldStore.currentLocationKey, worldStore.currentMapId),
    },
    { type: 'CROSS_EXIT', payload: { heroId: hero.id, from: worldStore.currentLocationKey } },
    worldStore.buildEngineContext(),
  );
  const exited = events.find((event) => event.type === 'BOARD_EXITED');
  if (!exited) return false;

  const crossing = exited.payload as BoardCrossing;
  heroStore.setPortal(hero.portal ?? null);
  heroStore.applyPortalClosures(portalClosedEvents(events));
  heroStore.heroCoordinates = { ...hero.coordinates };
  worldStore.pendingArrivalSide = crossing.arrivalSide;
  worldStore.goToLocation(crossing.to);
  await routeToLocation(crossing.to);
  return true;
}
