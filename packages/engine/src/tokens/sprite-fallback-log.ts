import type { ETokenType } from '../abstraction/hexobject-abstraction';
import type { SpriteResolution } from './sprite-fallback';
import type { ItemTypeKey } from './token-keys';

export type SpriteFallbackLog = (message: string) => void;

let log: SpriteFallbackLog | null = null;
const reported = new Set<string>();

export function setSpriteFallbackLog(next: SpriteFallbackLog | null): void {
  log = next;
  reported.clear();
}

export function reportSpriteFallback(
  tokenType: ETokenType,
  type: ItemTypeKey,
  resolution: SpriteResolution,
): void {
  if (log === null || resolution.step === 'own') return;
  const pair = `${tokenType}-${type}`;
  if (reported.has(pair)) return;
  reported.add(pair);
  const used = resolution.step === 'borrowed' ? `${resolution.from}-${type}` : 'the placeholder';
  log(`[sprites] base/${pair} has no sprite, ${used} is used`);
}
