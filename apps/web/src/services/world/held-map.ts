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
