import { atlasNeighbour, arrivalSideFor } from '@hexoflat/engine/content/boards/atlas';
import { isLocationKey } from '@hexoflat/engine/registry/location-key';
import { findFreeHexNearExit } from '@hexoflat/engine/map/free-hex-finder';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { routeToLocation } from '@/services/world/location-navigator';
import { useCombatStore } from '@/stores/combat-store';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';

export async function crossExitIfStanding(): Promise<boolean> {
  const worldStore = useWorldMapStore();
  const heroStore = useHeroStore();
  const map = worldStore.map as HexMapModel | null;
  const position = heroStore.heroCoordinates;

  if (!map || !position || useCombatStore().combatActive) return false;

  const standingOn = map.tiles.find(
    (tile) => coordinateKey(tile.coordinates) === coordinateKey(position),
  );
  if (!standingOn?.exit) return false;

  const nextLocation = atlasNeighbour(worldStore.currentLocationKey, standingOn.exit);
  if (!isLocationKey(nextLocation)) return false;

  const restingSpot = findFreeHexNearExit(map, standingOn.exit);
  if (restingSpot) heroStore.heroCoordinates = restingSpot;

  worldStore.pendingArrivalSide = arrivalSideFor(standingOn.exit);
  worldStore.goToLocation(nextLocation);
  await routeToLocation(nextLocation);
  return true;
}
