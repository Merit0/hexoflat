import { afterEach, describe, expect, it, vi } from 'vitest';
import { explorationSliceEnabled, isMultiplayerSession } from './feature-flags';

describe('web feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the exploration slice off when the env var is unset', () => {
    vi.stubEnv('VITE_FEATURE_EXPLORATION_SLICE', undefined);

    expect(explorationSliceEnabled()).toBe(false);
  });

  it('keeps it off for any value other than the exact string "true"', () => {
    for (const value of ['1', 'yes', 'TRUE', '']) {
      vi.stubEnv('VITE_FEATURE_EXPLORATION_SLICE', value);

      expect(explorationSliceEnabled()).toBe(false);
    }
  });

  it('turns it on when the env var asks for it in a single-player session', () => {
    vi.stubEnv('VITE_FEATURE_EXPLORATION_SLICE', 'true');

    expect(isMultiplayerSession()).toBe(false);
    expect(explorationSliceEnabled()).toBe(true);
  });
});
