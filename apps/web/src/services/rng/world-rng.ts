import { deriveStream } from '@hexoflat/engine/utils/random-seeded';
import type { RandomNumberGenerator } from '@hexoflat/engine/utils/random';

let baseSeed: string | null = null;
const streams = new Map<string, RandomNumberGenerator>();

export function reseedWorld(seed: string): void {
  if (seed === baseSeed) return;
  baseSeed = seed;
  streams.clear();
}

export function getWorldSeed(): string | null {
  return baseSeed;
}

export function getStream(label: string): RandomNumberGenerator {
  const existing = streams.get(label);
  if (existing) return existing;

  const stream = deriveStream(baseSeed ?? 'unseeded', label);
  streams.set(label, stream);
  return stream;
}
