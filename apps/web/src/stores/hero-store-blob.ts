import type { PiniaPluginContext } from 'pinia';
import { writeBlob } from '@/services/persistence/world-blob-store';

export const HERO_STORE_BLOB = 'hero-store';

const NAV_FIELDS = ['locationKey', 'locationMapId', 'returnStack'] as const;
const UNSAVED_FIELDS = ['knowledge', 'knowledgeError', 'heroCoordinates'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutUnsaved(state: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(state).filter(([key]) => !UNSAVED_FIELDS.includes(key)));
}

export function savableHeroState(state: object): Record<string, unknown> {
  return withoutUnsaved(state);
}

export function restorableHeroState(saved: unknown): Record<string, unknown> | null {
  if (!isRecord(saved)) return null;
  const restorable = withoutUnsaved(saved);
  if (!isRecord(restorable.nav)) return restorable;
  const source = restorable.nav;
  const nav = Object.fromEntries(
    NAV_FIELDS.filter((key) => key in source).map((key) => [key, source[key]]),
  );
  return { ...restorable, nav };
}

export function persistHeroStore(context: PiniaPluginContext): void {
  if (context.store.$id !== 'hero') return;

  context.store.$subscribe((_, state) => {
    try {
      writeBlob(HERO_STORE_BLOB, JSON.stringify(savableHeroState(state)));
    } catch (e) {
      console.warn('[pinia-persist] failed to persist "hero"', e);
    }
  });
}
