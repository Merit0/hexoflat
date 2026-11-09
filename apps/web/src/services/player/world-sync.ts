export interface WorldPush {
  locationKey: string;
  mapId: string;
  json: string;
}

const PUSH_DEBOUNCE_MS = 400;

const documents = new Map<string, string>();
const locationOfMap = new Map<string, string>();
const serverCopies = new Map<string, string>();
const pending = new Map<string, WorldPush>();
let timer: number | null = null;
let enabled = false;
let flusher: (() => Promise<void>) | null = null;
let currentMapId: (() => string | null) | null = null;
let snapshotter: ((force: boolean) => void) | null = null;

export function bindWorldFlusher(next: (() => Promise<void>) | null): void {
  flusher = next;
}

export function bindWorldSnapshotter(next: ((force: boolean) => void) | null): void {
  snapshotter = next;
}

export function bindCurrentMapId(next: (() => string | null) | null): void {
  currentMapId = next;
}

export function worldBody(push: WorldPush): string {
  const current = currentMapId?.() === push.mapId;
  return push.json.replace(/\}$/, `,"current":${current}}`);
}

export function snapshotWorld(force: boolean): void {
  snapshotter?.(force);
}

export function enableServerWorlds(): void {
  enabled = true;
}

export function isServerWorldMode(): boolean {
  return enabled;
}

function setDocument(locationKey: string, mapId: string, json: string): void {
  documents.set(locationKey, json);
  locationOfMap.set(mapId, locationKey);
}

export function cacheServerWorld(locationKey: string, mapId: string, json: string): void {
  setDocument(locationKey, mapId, json);
}

export function rememberServerWorld(locationKey: string, mapId: string, json: string): void {
  setDocument(locationKey, mapId, json);
  serverCopies.set(mapId, json);
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
  for (const [mapId, push] of pending) {
    if (push.locationKey === locationKey) pending.delete(mapId);
  }
}

export function dropPendingPushesOf(locationKey: string): void {
  for (const [mapId, push] of pending) {
    if (push.locationKey === locationKey) pending.delete(mapId);
  }
}

export function forgetAllServerWorlds(): void {
  documents.clear();
}

export function queueWorldPush(
  locationKey: string,
  mapId: string,
  json: string,
  options: { force?: boolean } = {},
): void {
  setDocument(locationKey, mapId, json);
  if (!options.force && serverCopies.get(mapId) === json) {
    pending.delete(mapId);
    return;
  }
  pending.delete(mapId);
  pending.set(mapId, { locationKey, mapId, json });
  if (timer !== null || !flusher) return;
  timer = window.setTimeout(() => {
    timer = null;
    void flusher?.();
  }, PUSH_DEBOUNCE_MS);
}

export function takePendingPushes(): WorldPush[] {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const taken = [...pending.values()];
  pending.clear();
  return taken;
}

export function pushSucceeded(push: WorldPush): void {
  serverCopies.set(push.mapId, push.json);
}

export function resetWorldSync(): void {
  enabled = false;
  documents.clear();
  locationOfMap.clear();
  serverCopies.clear();
  pending.clear();
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}
