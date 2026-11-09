/**
 * Where the world's documents (maps with their fog, battle snapshots, where the hero is) live in
 * the browser: a plain in-memory copy of what the server holds. Reads stay synchronous, as they
 * were with localStorage; every change is announced so `expedition-sync` can send it on.
 * No store, no network and no storage API in here, so it stays testable on its own.
 */
type Listener = (changed: { put: string[]; removed: string[] }) => void;

const blobs = new Map<string, string>();
let listener: Listener | null = null;

export function onBlobsChanged(next: Listener | null): void {
  listener = next;
}

export function readBlob(key: string): string | null {
  return blobs.get(key) ?? null;
}

export function writeBlob(key: string, data: string): void {
  blobs.set(key, data);
  listener?.({ put: [key], removed: [] });
}

export function removeBlob(key: string): void {
  if (blobs.delete(key)) listener?.({ put: [], removed: [key] });
}

export function blobKeys(prefix = ''): string[] {
  return [...blobs.keys()].filter((key) => key.startsWith(prefix));
}

/** Replaces the whole copy with what the server sent. Not announced: it is already saved. */
export function replaceBlobs(next: Record<string, string>): void {
  blobs.clear();
  for (const [key, data] of Object.entries(next)) blobs.set(key, data);
}

export function clearBlobs(): void {
  blobs.clear();
}
