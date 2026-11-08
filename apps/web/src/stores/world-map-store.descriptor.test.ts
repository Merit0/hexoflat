import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { readSavedWorldState } from '@/services/persistence/world-storage';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
}));

type SavedState = { contentVersion?: number; descriptor?: { drawingHash?: string } | null };

describe('useWorldMapStore: loading a map that finishes a due action', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps the location its own descriptor instead of the one it was left from', () => {
    const world = useWorldMapStore();
    world.goToLocation('camping');
    const campId = world.currentMapId!;
    const campHash = (world.descriptor as { drawingHash?: string }).drawingHash;
    const coins = (world.map as HexMapModel).tiles.find(
      (tile) => tile.coordinates.columnIndex === 8 && tile.coordinates.rowIndex === 7,
    )!;
    coins.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, coins.coordinates);
    coins.pendingAction = {
      type: EHexActionType.TAKE,
      startedAt: 0,
      endsAt: 1,
      hexobjectKey: HEXOBJECT_KEYS.COINS,
    };
    world.saveToStorage();

    world.goToLocation('silesia');
    const silesiaHash = (world.descriptor as { drawingHash?: string }).drawingHash;
    world.goToLocation('camping');

    expect(silesiaHash).not.toBe(campHash);
    expect(readSavedWorldState<SavedState>(campId)?.descriptor?.drawingHash).toBe(campHash);
    expect((world.descriptor as { drawingHash?: string }).drawingHash).toBe(campHash);
  });
});
