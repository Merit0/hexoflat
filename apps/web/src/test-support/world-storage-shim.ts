import {
  blobKeys,
  clearBlobs,
  readBlob,
  removeBlob,
  writeBlob,
} from '@/services/persistence/world-blob-store';

const LEGACY: [string, string][] = [
  ['hexoflat:world:map:v1:', 'map:'],
  ['hexoflat:world:state:v1:', 'state:'],
  ['hexoflat:world:index:v1', 'index'],
  ['hexoflat:world:respawn-at:v1', 'respawn'],
];

function toBlobKey(key: string): string {
  const hit = LEGACY.find(([legacy]) => key.startsWith(legacy));
  return hit ? hit[1] + key.slice(hit[0].length) : key;
}

/** The old localStorage-shaped view of the world documents, so characterization tests keep their wording. */
export const worldStorage = {
  getItem: (key: string) => readBlob(toBlobKey(key)),
  setItem: (key: string, value: string) => writeBlob(toBlobKey(key), value),
  removeItem: (key: string) => removeBlob(toBlobKey(key)),
  clear: () => clearBlobs(),
  get length() {
    return blobKeys().length;
  },
};
