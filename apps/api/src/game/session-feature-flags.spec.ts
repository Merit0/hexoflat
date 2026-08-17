import { afterEach, describe, expect, it } from 'vitest';
import {
  isExplorationSliceEnabledForScenarioRoom,
  scenarioRoomFeatureContext,
} from './session-feature-flags';

describe('scenario room feature flags', () => {
  const original = process.env.FEATURE_EXPLORATION_SLICE;

  afterEach(() => {
    if (original === undefined) delete process.env.FEATURE_EXPLORATION_SLICE;
    else process.env.FEATURE_EXPLORATION_SLICE = original;
  });

  it('treats every scenario room as a multiplayer session', () => {
    expect(scenarioRoomFeatureContext().isMultiplayerSession).toBe(true);
  });

  it('keeps the exploration slice off when the env var is unset', () => {
    delete process.env.FEATURE_EXPLORATION_SLICE;

    expect(isExplorationSliceEnabledForScenarioRoom()).toBe(false);
  });

  it('keeps the exploration slice off even when the env var asks for it', () => {
    // The point of the phase: a stray env var on the server must not enable
    // rules that were never scoped for concurrent actors.
    process.env.FEATURE_EXPLORATION_SLICE = 'true';

    expect(scenarioRoomFeatureContext().explorationSliceRequested).toBe(true);
    expect(isExplorationSliceEnabledForScenarioRoom()).toBe(false);
  });
});
