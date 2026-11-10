const documents = new Map<string, string>();

export function cacheServerWorld(locationKey: string, json: string): void {
  documents.set(locationKey, json);
}

export function cachedWorldJson(locationKey: string): string | null {
  return documents.get(locationKey) ?? null;
}

export function forgetServerWorld(locationKey: string): void {
  documents.delete(locationKey);
}

export function forgetAllServerWorlds(): void {
  documents.clear();
}

export function resetWorldSync(): void {
  documents.clear();
}
