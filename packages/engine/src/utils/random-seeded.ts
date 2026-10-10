import { sha256Hex } from './hash/sha256';
import type { RandomNumberGenerator } from './random';

export interface RngState {
  seed: string;
  counter: number;
}

export type SeededRandom = RandomNumberGenerator & { readonly state: RngState };

const MANTISSA_HEX = 13;
const MANTISSA_MAX = 2 ** 52;

export function createSeededRandom(initial: RngState): SeededRandom {
  const state: RngState = { seed: initial.seed, counter: initial.counter };

  const generator = (() => {
    const digest = sha256Hex(`${state.seed}:${state.counter}`);
    state.counter += 1;
    return parseInt(digest.slice(0, MANTISSA_HEX), 16) / MANTISSA_MAX;
  }) as SeededRandom;

  Object.defineProperty(generator, 'state', { get: (): RngState => ({ ...state }) });
  return generator;
}

export function deriveStream(seed: string, label: string): SeededRandom {
  return createSeededRandom({ seed: sha256Hex(`${seed}:${label}`), counter: 0 });
}
