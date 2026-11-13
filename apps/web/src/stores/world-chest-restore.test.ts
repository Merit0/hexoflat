import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { holdServedWorld, seedFakeSession } from '@/test-support/fake-session';
import { fakeStoredWorldOf } from '@/test-support/fake-player-server';
import { useWorldMapStore } from './world-map-store';
import { useHeroStore } from './hero-store';

describe('session restore with the hero standing on a chest hex', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-chest');
  });

  it('keeps the hero on the chest and the items on their hexes with their quantities', () => {
    const served = fakeStoredWorldOf('silesia')!;
    const chest = { ...served.heroCoordinates! };
    const tileAt = (at: { columnIndex: number; rowIndex: number }) =>
      served.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === at.columnIndex && t.coordinates.rowIndex === at.rowIndex,
      )!;
    tileAt(chest).hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST_OPEN, chest);
    const spots = getHexNeighbors(chest).filter((at) => {
      const tile = tileAt(at);
      return !!tile && !tile.hexobject;
    });
    const spot = spots[0];
    tileAt(spot).hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, spot, { quantity: 9 });
    holdServedWorld(served);

    useWorldMapStore().loadLocationMap('silesia');

    const world = useWorldMapStore();
    expect(useHeroStore().heroCoordinates).toEqual(chest);
    const restored = world.getTileAt(spot)!.hexobject!;
    expect(restored.hexobjectKey).toBe(HEXOBJECT_KEYS.COINS);
    expect(restored.quantity).toBe(9);
    expect(world.getTileAt(chest)!.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
  });
});
