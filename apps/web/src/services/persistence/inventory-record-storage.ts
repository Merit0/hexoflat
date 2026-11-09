import {
  clearSavedInventory,
  bagPayload,
  parseSavedBag,
  readSavedInventory,
  type SavedBag,
} from './inventory-storage';
import {
  clearSavedStash,
  parseSavedStash,
  readSavedStash,
  stashPayload,
  type SavedStash,
} from './stash-storage';

const RECORD_KEY = 'hexoflat:inventory:v2:hero';

export interface InventoryRecord {
  bag: SavedBag | null;
  stash: SavedStash | null;
}

function writeRecord(record: InventoryRecord): boolean {
  try {
    localStorage.setItem(
      RECORD_KEY,
      JSON.stringify({
        version: 2,
        bag: record.bag ? bagPayload(record.bag) : null,
        stash: record.stash ? stashPayload(record.stash) : null,
      }),
    );
    return true;
  } catch (error) {
    console.error('Failed to persist the hero inventory:', error);
    return false;
  }
}

function readCurrent(): InventoryRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; bag?: unknown; stash?: unknown };
    if (parsed?.version !== 2) return null;
    return { bag: parseSavedBag(parsed.bag), stash: parseSavedStash(parsed.stash) };
  } catch (error) {
    console.error('Failed to read the hero inventory:', error);
    return null;
  }
}

export function readInventoryRecord(): InventoryRecord {
  const current = readCurrent();
  if (current) return current;
  const legacy: InventoryRecord = { bag: readSavedInventory(), stash: readSavedStash() };
  if ((legacy.bag || legacy.stash) && writeRecord(legacy)) {
    clearSavedInventory();
    clearSavedStash();
  }
  return legacy;
}

export function patchInventoryRecord(patch: Partial<InventoryRecord>): void {
  const current = readInventoryRecord();
  writeRecord({ bag: patch.bag ?? current.bag, stash: patch.stash ?? current.stash });
}

export function clearInventoryRecord(): void {
  localStorage.removeItem(RECORD_KEY);
  clearSavedInventory();
  clearSavedStash();
}
