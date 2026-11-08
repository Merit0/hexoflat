import { z } from 'zod';
import { CONTENT_VERSION } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  STASH_CAPACITY,
  STASH_CHEST_CELLS,
  STASH_MAX_CHESTS,
} from '@hexoflat/engine/inventory/stash-constants';

const STASH_STORAGE_KEY = 'hexoflat.hero.stash.v2';
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

const itemSchema = z.object({
  id: z.string().min(1),
  key: z.string().refine((key) => KNOWN_KEYS.has(key)),
  type: z.string(),
  stackKey: z.string().optional(),
  amount: z.number().int().positive(),
  equipSlot: z.string().optional(),
  slotKey: z.string(),
  isNew: z.boolean(),
});

const payloadSchema = z.object({
  version: z.literal(2),
  contentVersion: z.number(),
  chests: z.number().int().min(0).max(STASH_MAX_CHESTS),
  cells: z.array(z.unknown()),
});

export type StashCells = (InventoryItem | null)[];

export interface SavedStash {
  chests: number;
  cells: StashCells;
}

function readCell(value: unknown, seen: Set<string>): InventoryItem | null {
  const parsed = itemSchema.safeParse(value);
  if (!parsed.success || seen.has(parsed.data.id)) return null;
  seen.add(parsed.data.id);
  return parsed.data as InventoryItem;
}

export function readSavedStash(): SavedStash | null {
  try {
    const raw = localStorage.getItem(STASH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = payloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.contentVersion !== CONTENT_VERSION) return null;
    const seen = new Set<string>();
    const opened = parsed.data.chests * STASH_CHEST_CELLS;
    const cells = Array.from({ length: STASH_CAPACITY }, (_, index) =>
      index < opened ? readCell(parsed.data.cells[index], seen) : null,
    );
    return { chests: parsed.data.chests, cells };
  } catch (error) {
    console.error('Failed to hydrate the camp stash:', error);
    return null;
  }
}

export function writeSavedStash(stash: SavedStash): void {
  try {
    const payload = { version: 2, contentVersion: CONTENT_VERSION, ...stash };
    localStorage.setItem(STASH_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist the camp stash:', error);
  }
}

export function clearSavedStash(): void {
  localStorage.removeItem(STASH_STORAGE_KEY);
}
