const documents = new Map<string, string>();
const locationOfMap = new Map<string, string>();
let enabled = false;

export function enableServerWorlds(): void {
  enabled = true;
}

export function isServerWorldMode(): boolean {
  return enabled;
}

export function cacheServerWorld(locationKey: string, mapId: string, json: string): void {
  documents.set(locationKey, json);
  locationOfMap.set(mapId, locationKey);
}

export function rememberServerWorld(locationKey: string, mapId: string, json: string): void {
  cacheServerWorld(locationKey, mapId, json);
}

export function cachedWorldJson(locationKey: string): string | null {
  return documents.get(locationKey) ?? null;
}

export function cachedWorldJsonByMap(mapId: string): { locationKey: string; json: string } | null {
  const locationKey = locationOfMap.get(mapId);
  const json = locationKey ? documents.get(locationKey) : undefined;
  return locationKey && json ? { locationKey, json } : null;
}

export function forgetServerWorld(locationKey: string): void {
  documents.delete(locationKey);
}

export function forgetAllServerWorlds(): void {
  documents.clear();
}

export function resetWorldSync(): void {
  enabled = false;
  documents.clear();
  locationOfMap.clear();
}
