import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import {
  readSavedMap,
  readSavedWorldState,
  removeSavedWorld,
  scheduleWorldSave,
} from './world-storage';

const MAP_ID = 'map-under-test';

function mapSnapshot(width: number): string {
  return JSON.stringify({ contentVersion: CONTENT_VERSION, map: { width, height: 1, tiles: [] } });
}

function stateSnapshot(seed: string): string {
  return JSON.stringify({ contentVersion: CONTENT_VERSION, worldSeed: seed });
}

describe('world-storage debounced writes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('reads back a queued save before its debounce flushes (read-your-writes)', () => {
    scheduleWorldSave(MAP_ID, mapSnapshot(7), stateSnapshot('seed-a'));

    expect(localStorage.getItem(`hexoflat:world:map:v1:${MAP_ID}`)).toBeNull();
    expect(readSavedMap(MAP_ID)).toEqual({ width: 7, height: 1, tiles: [] });
    expect(
      readSavedWorldState<{ contentVersion?: number; worldSeed?: string }>(MAP_ID)?.worldSeed,
    ).toBe('seed-a');
  });

  it('a later queued save supersedes the earlier pending one', () => {
    scheduleWorldSave(MAP_ID, mapSnapshot(7), stateSnapshot('seed-a'));
    scheduleWorldSave(MAP_ID, mapSnapshot(9), stateSnapshot('seed-b'));

    expect(readSavedMap(MAP_ID)).toEqual({ width: 9, height: 1, tiles: [] });

    vi.runOnlyPendingTimers();
    expect(readSavedMap(MAP_ID)).toEqual({ width: 9, height: 1, tiles: [] });
  });

  it('removeSavedWorld drops a still-pending save so it never lands', () => {
    scheduleWorldSave(MAP_ID, mapSnapshot(7), stateSnapshot('seed-a'));
    removeSavedWorld(MAP_ID);

    expect(readSavedMap(MAP_ID)).toBeNull();

    vi.runOnlyPendingTimers();
    expect(localStorage.getItem(`hexoflat:world:map:v1:${MAP_ID}`)).toBeNull();
  });
});
