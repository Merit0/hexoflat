import { describe, expect, it } from 'vitest';
import { FEATURE_EXPLORATION_SLICE, isExplorationSliceEnabled } from './feature-flags';

describe('FEATURE_EXPLORATION_SLICE', () => {
  it('is off by default', () => {
    expect(
      isExplorationSliceEnabled({
        explorationSliceRequested: false,
        isMultiplayerSession: false,
      }),
    ).toBe(false);
  });

  it('is on when requested in a single-player session', () => {
    expect(
      isExplorationSliceEnabled({
        explorationSliceRequested: true,
        isMultiplayerSession: false,
      }),
    ).toBe(true);
  });

  it('is off in a multiplayer session even when requested', () => {
    // The invariant this file exists for: multiplayer wins over the config,
    // so a stray env var in a server build cannot switch the slice on.
    expect(
      isExplorationSliceEnabled({
        explorationSliceRequested: true,
        isMultiplayerSession: true,
      }),
    ).toBe(false);
  });

  it('is off in a multiplayer session when not requested', () => {
    expect(
      isExplorationSliceEnabled({
        explorationSliceRequested: false,
        isMultiplayerSession: true,
      }),
    ).toBe(false);
  });

  it('never returns true for any multiplayer input', () => {
    for (const explorationSliceRequested of [true, false]) {
      expect(
        isExplorationSliceEnabled({ explorationSliceRequested, isMultiplayerSession: true }),
      ).toBe(false);
    }
  });

  it('exposes a stable flag name for config and telemetry to key on', () => {
    expect(FEATURE_EXPLORATION_SLICE).toBe('FEATURE_EXPLORATION_SLICE');
  });
});
