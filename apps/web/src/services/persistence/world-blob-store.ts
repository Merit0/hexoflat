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

export function replaceBlobs(next: Record<string, string>): void {
  blobs.clear();
  for (const [key, data] of Object.entries(next)) blobs.set(key, data);
}

export function clearBlobs(): void {
  blobs.clear();
}
