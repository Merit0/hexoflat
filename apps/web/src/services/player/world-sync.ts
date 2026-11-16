const documents = new Map<string, string>();
const evicted = new Set<string>();

function mapIdOf(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { mapId?: unknown };
    return typeof parsed.mapId === 'string' ? parsed.mapId : null;
  } catch {
    return null;
  }
}

export function cacheServerWorld(locationKey: string, json: string): void {
  documents.set(locationKey, json);
  evicted.delete(locationKey);
}

export function cachedWorldJson(locationKey: string): string | null {
  return documents.get(locationKey) ?? null;
}

export function forgetServerWorld(locationKey: string): void {
  documents.delete(locationKey);
}

export function evictStaleServerWorld(locationKey: string, mapId: string): void {
  const json = documents.get(locationKey);
  if (!json || mapIdOf(json) !== mapId) return;
  documents.delete(locationKey);
  evicted.add(locationKey);
}

export function wasEvicted(locationKey: string): boolean {
  return evicted.has(locationKey);
}

export function forgetAllServerWorlds(): void {
  documents.clear();
  evicted.clear();
}

export function resetWorldSync(): void {
  documents.clear();
  evicted.clear();
}
