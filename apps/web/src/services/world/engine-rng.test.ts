import { beforeEach, describe, expect, it } from 'vitest';
import { createSeededRandom } from '@hexoflat/engine/utils/seeded-random';
import { engineRandom, getEngineRngState, initEngineRng, resetEngineRng } from './engine-rng';

describe('engine-rng service', () => {
  beforeEach(() => {
    resetEngineRng();
  });

  it('hands every caller the same live state object', () => {
    initEngineRng('map-1');

    expect(getEngineRngState()).toBe(getEngineRngState());
  });

  it('advances one shared cursor no matter which caller draws', () => {
    initEngineRng('map-1');

    engineRandom()();
    engineRandom()();

    expect(getEngineRngState().cursor).toBe(2);
  });

  it('reproduces the same sequence for the same map id', () => {
    const run = () => {
      initEngineRng('map-1');
      const random = engineRandom();
      return [random(), random(), random()];
    };

    expect(run()).toEqual(run());
  });

  it('gives different worlds different sequences', () => {
    initEngineRng('map-1');
    const first = engineRandom()();

    initEngineRng('map-2');
    const second = engineRandom()();

    expect(first).not.toBe(second);
  });

  it('resumes a restored sequence instead of replaying it', () => {
    initEngineRng('map-1');
    const uninterrupted = createSeededRandom({ seed: 'map-1', cursor: 0 });
    uninterrupted();
    uninterrupted();
    const fourthDraw = (uninterrupted(), uninterrupted());

    initEngineRng('map-1', { seed: 'map-1', cursor: 3 });

    expect(engineRandom()()).toBe(fourthDraw);
  });

  it('copies the restored state so the saved payload is not advanced behind its back', () => {
    const saved = { seed: 'map-1', cursor: 5 };
    initEngineRng('map-1', saved);

    engineRandom()();

    expect(saved.cursor).toBe(5);
    expect(getEngineRngState().cursor).toBe(6);
  });

  it('falls back to a per-session seed when no world has been loaded', () => {
    const first = getEngineRngState();

    expect(first.cursor).toBe(0);
    expect(first.seed).not.toBe('');

    resetEngineRng();
    expect(getEngineRngState().seed).not.toBe(first.seed);
  });
});
