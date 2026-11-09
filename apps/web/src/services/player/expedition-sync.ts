import { apiClient, ApiError } from '@/api/client';
import { inventorySession } from '@/services/inventory/inventory-session';
import {
  blobKeys,
  clearBlobs,
  onBlobsChanged,
  readBlob,
  replaceBlobs,
} from '@/services/persistence/world-blob-store';

const SEND_DEBOUNCE_MS = 400;
const KEEPALIVE_LIMIT_BYTES = 60_000;

/**
 * D4a, temporary: the world is still played on the client, so the server keeps what the client
 * reports (maps with fog, battle snapshots, where the hero is) as opaque documents. This module
 * loads them when the session starts and sends changes on, a short moment after they happen.
 * D4b replaces it with server-held state.
 */
const dirtyPut = new Set<string>();
const dirtyRemoved = new Set<string>();
let timer: number | null = null;
let inFlight: Promise<void> = Promise.resolve();
let takenOver: (() => void) | null = null;
let hiddenListenerBound = false;

export function onExpeditionTakenOver(listener: (() => void) | null): void {
  takenOver = listener;
}

function takeDirty(): { put: Record<string, string>; remove: string[] } | null {
  if (dirtyPut.size === 0 && dirtyRemoved.size === 0) return null;
  const put: Record<string, string> = {};
  for (const key of dirtyPut) {
    const data = readBlob(key);
    if (data !== null) put[key] = data;
  }
  const remove = [...dirtyRemoved];
  dirtyPut.clear();
  dirtyRemoved.clear();
  return { put, remove };
}

function headers(): Record<string, string> {
  return { 'X-Player-Session': inventorySession.sessionToken ?? '' };
}

async function send(keepalive: boolean): Promise<void> {
  const batch = takeDirty();
  if (!batch) return;
  try {
    await apiClient.patch('/expeditions/current', batch, { headers: headers(), keepalive });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      inventorySession.sessionToken = null;
      takenOver?.();
      return;
    }
    for (const key of Object.keys(batch.put)) dirtyPut.add(key);
    for (const key of batch.remove) dirtyRemoved.add(key);
  }
}

function schedule(): void {
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    inFlight = inFlight.then(() => send(false));
  }, SEND_DEBOUNCE_MS);
}

/** Sends everything that changed so far and waits for the server. */
export function flushExpedition(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  inFlight = inFlight.then(() => send(false));
  return inFlight;
}

function flushOnLeave(): void {
  if (inventorySession.status !== 'live') return;
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const size = [...dirtyPut].reduce((sum, key) => sum + (readBlob(key)?.length ?? 0), 0);
  void send(size < KEEPALIVE_LIMIT_BYTES);
}

function bindHiddenFlush(): void {
  if (hiddenListenerBound || typeof document === 'undefined') return;
  hiddenListenerBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave();
  });
  window.addEventListener('pagehide', flushOnLeave);
}

/** Loads the hero's expedition into the browser copy and starts sending changes. */
export async function startExpeditionSync(): Promise<void> {
  const current = await apiClient.get<{ blobs: Record<string, string> }>('/expeditions/current');
  dirtyPut.clear();
  dirtyRemoved.clear();
  replaceBlobs(current.blobs);
  onBlobsChanged(({ put, removed }) => {
    if (inventorySession.status !== 'live') return;
    for (const key of put) {
      dirtyPut.add(key);
      dirtyRemoved.delete(key);
    }
    for (const key of removed) {
      dirtyRemoved.add(key);
      dirtyPut.delete(key);
    }
    schedule();
  });
  bindHiddenFlush();
}

export function stopExpeditionSync(): void {
  onBlobsChanged(null);
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  dirtyPut.clear();
  dirtyRemoved.clear();
  clearBlobs();
}

export function expeditionDocumentKeys(): string[] {
  return blobKeys();
}
