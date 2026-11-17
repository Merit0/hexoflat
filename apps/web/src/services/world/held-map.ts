import { MAP_MISMATCH } from '@hexoflat/engine/world/map-guard';
import { HERO_ELSEWHERE } from '@hexoflat/engine/world/enter-rule';

export interface HeldMap {
  currentLocationKey: string;
  currentMapId: string | null;
}

export function holdsPlace(host: HeldMap, place: { locationKey: string; mapId: string }): boolean {
  return place.locationKey === host.currentLocationKey && place.mapId === host.currentMapId;
}

export function holdsMap(host: HeldMap, mapId: string | null | undefined): boolean {
  return !mapId || mapId === host.currentMapId;
}

const RECOVERED_REFUSALS: readonly string[] = [MAP_MISMATCH, HERO_ELSEWHERE];

export function isRecoveredRefusal(code: string | undefined): boolean {
  return RECOVERED_REFUSALS.includes(code ?? '');
}
