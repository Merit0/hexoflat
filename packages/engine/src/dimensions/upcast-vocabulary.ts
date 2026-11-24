import type { DomainEvent } from '../commands/types';
import { upcastDropContext } from '../tokens/drop-context';
import { upcastTokenDimension } from '../tokens/upcast-token-dimension';

const RENAMED_DROP_CONTEXT_KEYS: Readonly<Record<string, string>> = {
  tokenOrigin: 'dropContext',
  rewardOrigin: 'rewardDropContext',
};

const DROP_CONTEXT_KEYS: ReadonlySet<string> = new Set(['dropContext', 'rewardDropContext']);

function isLegacyToken(value: Record<string, unknown>): boolean {
  return (value.origin === 'base' || value.origin === 'unique') && 'rarity' in value;
}

/** Old-save reader: renames the pre-DA3b vocabulary in a stored document; never rerolls a value. */
export function upcastDimensionVocabulary(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(upcastDimensionVocabulary);
  if (!raw || typeof raw !== 'object') return raw;
  const source = raw as Record<string, unknown>;
  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    const target = RENAMED_DROP_CONTEXT_KEYS[key] ?? key;
    if (target !== key && target in source) continue;
    const walked = upcastDimensionVocabulary(value);
    renamed[target] = DROP_CONTEXT_KEYS.has(target) ? upcastDropContext(walked) : walked;
  }
  return isLegacyToken(renamed) ? upcastTokenDimension(renamed) : renamed;
}

/** Old-save reader for journal replies: events written before DA3b leave the server in the new vocabulary. */
export function upcastJournalEvents(raw: unknown): DomainEvent[] {
  return upcastDimensionVocabulary(raw) as DomainEvent[];
}
