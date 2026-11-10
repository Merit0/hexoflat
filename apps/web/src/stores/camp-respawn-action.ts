import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';

export interface CampRespawnHost {
  goToLocation(locationKey: LocationKey): void;
}

export interface CampRespawnDeps {
  events: { push(source: string, text: string, type: 'BATTLE'): void };
  battle: { close(): void };
  installTravel(result: WorldCommandResult): LocationKey | null;
  isViewingOtherWorldLocation(locationKey: LocationKey): boolean;
  routeToLocation(locationKey: LocationKey): Promise<void>;
}

export async function respawnHeroAtCampingAction(
  host: CampRespawnHost,
  result: WorldCommandResult,
  deps: CampRespawnDeps,
): Promise<void> {
  deps.battle.close();
  const destination = deps.installTravel(result) ?? 'camping';
  host.goToLocation(destination);
  deps.events.push('Battle', 'hero was defeated and returned to camping', 'BATTLE');
  if (deps.isViewingOtherWorldLocation(destination)) await deps.routeToLocation(destination);
}
