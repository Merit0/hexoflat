import { beforeEach, describe, expect, it } from 'vitest';
import { computed, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useWorldMapStore } from './world-map-store';

/**
 * `getTileAt` used to be a linear `tiles.find(...)`; E0 moved it onto
 * `HexMapModel`'s cached coordinate index.
 *
 * The engine tests cover correctness of the index itself. What only shows up
 * here is reactivity: a lookup that scans every tile registers a dependency on
 * every tile, while an indexed lookup registers far fewer. If that narrowing
 * dropped a dependency the UI relies on, overlays and hover previews would
 * quietly stop updating — which no engine test can see.
 */

function buildMap() {
  const map = new HexMapBuilder().name('tile-index').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

describe('world-map-store.getTileAt through Pinia reactivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('returns null when no map is loaded', () => {
    expect(useWorldMapStore().getTileAt({ columnIndex: 0, rowIndex: 0 })).toBeNull();
  });

  it('finds every tile of the loaded map', () => {
    const store = useWorldMapStore();
    store.map = buildMap();

    for (const tile of store.map.tiles) {
      expect(store.getTileAt(tile.coordinates)).toBe(tile);
    }
  });

  it('returns null for coordinates off the map', () => {
    const store = useWorldMapStore();
    store.map = buildMap();

    expect(store.getTileAt({ columnIndex: 99, rowIndex: 99 })).toBeNull();
  });

  it('re-evaluates a computed when the looked-up tile’s contents change', async () => {
    const store = useWorldMapStore();
    store.map = buildMap();
    const coords = { columnIndex: 1, rowIndex: 1 };

    const objectKey = computed(() => store.getTileAt(coords)?.hexobject?.hexobjectKey ?? null);
    expect(objectKey.value).toBeNull();

    const tile = store.getTileAt(coords)!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
    await nextTick();

    expect(objectKey.value).toBe(HEXOBJECT_KEYS.TREE);
  });

  it('re-evaluates a computed when the whole map is swapped out', async () => {
    const store = useWorldMapStore();
    store.map = buildMap();
    const coords = { columnIndex: 2, rowIndex: 2 };

    // Reads `store.map` so the computed tracks the swap itself, which is what
    // a real overlay does.
    const found = computed(() => (store.map ? store.getTileAt(coords) : null));
    expect(found.value).not.toBeNull();

    store.map = new HexMapBuilder().name('smaller').width(1).height(1).build();
    await nextTick();

    expect(found.value).toBeNull();
  });

  it('sees a tile appended to the loaded map', () => {
    const store = useWorldMapStore();
    store.map = buildMap();
    const coords = { columnIndex: 40, rowIndex: 40 };
    expect(store.getTileAt(coords)).toBeNull();

    const extra = new HexTileModel();
    extra.coordinates = coords;
    store.map.tiles.push(extra);

    expect(store.getTileAt(coords)?.coordinates).toEqual(coords);
  });

  it('follows the map across a load, not the map it was first asked about', () => {
    const store = useWorldMapStore();
    store.map = buildMap();
    const coords = { columnIndex: 2, rowIndex: 2 };
    const firstMapTile = store.getTileAt(coords);

    store.map = buildMap();

    expect(store.getTileAt(coords)).not.toBe(firstMapTile);
    expect(store.getTileAt(coords)).toBe(store.map.getTileAt(coords));
  });
});
