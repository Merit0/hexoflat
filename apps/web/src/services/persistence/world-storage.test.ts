import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import type { ISerializedHexMap } from '@hexoflat/engine/map/models/hex-map-model';
import {
  readSavedMap,
  readSavedWorldState,
  removeSavedWorld,
  scheduleWorldSave,
} from './world-storage';

function mapEnvelope(overrides: Partial<ISerializedHexMap> = {}): string {
  return JSON.stringify({
    contentVersion: CONTENT_VERSION,
    map: { name: 'test', width: 3, height: 3, complexity: 0, config: [], tiles: [], ...overrides },
  });
}

function stateEnvelope(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ contentVersion: CONTENT_VERSION, ...extra });
}

describe('world-storage (characterization)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('readSavedMap sees a still-pending (debounced) save before it flushes to localStorage', () => {
    const mapId = 'map-read-your-writes';
    scheduleWorldSave(mapId, mapEnvelope(), stateEnvelope());

    expect(localStorage.getItem('hexoflat:world:map:v1:' + mapId)).toBeNull();
    expect(readSavedMap(mapId)?.name).toBe('test');
  });

  it('readSavedWorldState sees a still-pending save too, and a later queued save supersedes the earlier one', () => {
    const mapId = 'map-supersede';
    scheduleWorldSave(
      mapId,
      mapEnvelope(),
      stateEnvelope({ heroCoordinates: { columnIndex: 0, rowIndex: 0 } }),
    );
    scheduleWorldSave(
      mapId,
      mapEnvelope(),
      stateEnvelope({ heroCoordinates: { columnIndex: 1, rowIndex: 1 } }),
    );

    const state = readSavedWorldState<{
      contentVersion?: number;
      heroCoordinates: { columnIndex: number; rowIndex: number };
    }>(mapId);
    expect(state?.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 1 });

    vi.runAllTimers();
    expect(readSavedWorldState(mapId)).toEqual(state);
  });

  it('removeSavedWorld cancels a still-pending save so it never reaches localStorage', () => {
    const mapId = 'map-cancelled';
    scheduleWorldSave(mapId, mapEnvelope(), stateEnvelope());

    removeSavedWorld(mapId);
    vi.runAllTimers();

    expect(localStorage.getItem('hexoflat:world:map:v1:' + mapId)).toBeNull();
    expect(readSavedMap(mapId)).toBeNull();
  });

  it('preserves a sparse tiles array (fewer tiles than width x height) across a real flush', () => {
    const mapId = 'map-sparse';
    const sparseTiles = [{ coordinates: { columnIndex: 0, rowIndex: 0 }, isRevealed: true }];
    scheduleWorldSave(
      mapId,
      mapEnvelope({ width: 18, height: 17, tiles: sparseTiles }),
      stateEnvelope(),
    );

    vi.runAllTimers();
    const restored = readSavedMap(mapId);

    expect(restored?.tiles).toHaveLength(1);
    expect(restored?.width).toBe(18);
    expect(restored?.height).toBe(17);
  });
});
