import { describe, expect, it } from 'vitest';
import { coordinateKey } from '../../utils/hex-utils';
import { BROKEN_SPIRE_APPROACH_V1, FIXTURE_GRID, WORLD_ENTRY } from './broken-spire-approach-v1';
import { buildFixtureMap, getFixtureHexAt } from './build-fixture-map';
import { resolveLandmarkPromises } from './landmark-promise';

const SPIRE = { columnIndex: 9, rowIndex: 4 };

describe('VS-01 — Camp entry / organic frontier (design §43)', () => {
  const map = buildFixtureMap(BROKEN_SPIRE_APPROACH_V1);
  const discoveryAt = (columnIndex: number, rowIndex: number) =>
    map.getTileAt({ columnIndex, rowIndex })?.discovery;

  it('generates the full technical grid', () => {
    expect(map.width).toBe(FIXTURE_GRID.width);
    expect(map.height).toBe(FIXTURE_GRID.height);
    expect(map.tiles).toHaveLength(FIXTURE_GRID.width * FIXTURE_GRID.height);
  });

  it('stamps the authored world-entry state (brief block 4)', () => {
    expect(discoveryAt(2, 1)).toBe('UNDERSTOOD'); // camp_world_anchor
    expect(discoveryAt(3, 1)).toBe('DISCOVERED'); // world_exit_spawn — hero appears here
    expect(discoveryAt(3, 0)).toBe('DISCOVERED'); // old_marked_ridge
    expect(discoveryAt(2, 0)).toBe('DISCOVERED'); // camp_nw
    expect(discoveryAt(1, 0)).toBe('DISCOVERED'); // camp_w
    expect(discoveryAt(1, 1)).toBe('DISCOVERED'); // camp_sw
    expect(discoveryAt(2, 2)).toBe('DISCOVERED'); // camp_se
    expect(discoveryAt(3, 2)).toBe('OBSERVED'); // camp_e_south — the soft edge
    expect(discoveryAt(4, 2)).toBe('OBSERVED'); // ridge_junction
  });

  it('leaves everything else UNKNOWN', () => {
    const known = map.tiles.filter((tile) => tile.discovery !== 'UNKNOWN');

    expect(known).toHaveLength(9);
    expect(new Set(known.map((tile) => coordinateKey(tile.coordinates)))).toEqual(
      new Set(['2:1', '3:1', '3:0', '2:0', '1:0', '1:1', '2:2', '3:2', '4:2']),
    );
  });

  it('does not read as a rectangular board (I13)', () => {
    // The technical grid is 126 hexes; 9 of them exist for the player. The
    // renderer draws nothing for the other 117 and excludes them from the
    // board's bounds, so there is no rectangle to see.
    const visible = map.tiles.filter((tile) => tile.discovery !== 'UNKNOWN');

    expect(visible.length).toBeLessThan(map.tiles.length / 10);

    const columns = new Set(visible.map((tile) => tile.coordinates.columnIndex));
    const rows = new Set(visible.map((tile) => tile.coordinates.rowIndex));
    // A rectangle would have every (column, row) combination filled.
    expect(visible.length).toBeLessThan(columns.size * rows.size);
  });

  it('keeps terrain and traversal in the fixture, not on runtime tiles', () => {
    // Rule #3: content stays separate from runtime state. Nothing in E1 needs
    // terrain at runtime, so nothing carries it there.
    expect(
      getFixtureHexAt(BROKEN_SPIRE_APPROACH_V1, { columnIndex: 3, rowIndex: 0 }),
    ).toMatchObject({ terrain: 'STONE_MASS', traversal: 'BLOCKED' });
    expect(
      getFixtureHexAt(BROKEN_SPIRE_APPROACH_V1, { columnIndex: 5, rowIndex: 2 }),
    ).toMatchObject({ terrain: 'STONE_CRUST', traversal: 'DESTRUCTIBLE' });
    expect(getFixtureHexAt(BROKEN_SPIRE_APPROACH_V1, { columnIndex: 11, rowIndex: 8 })).toBeNull();
  });

  it('rejects a fixture whose hex falls outside the technical grid', () => {
    const oversized = structuredClone(BROKEN_SPIRE_APPROACH_V1);
    oversized.hexes[0].coordinates = { columnIndex: 99, rowIndex: 0 };

    expect(() => buildFixtureMap(oversized)).toThrow(/outside the 14x9 technical grid/);
  });
});

describe('Broken Spire distant observation (brief block 6)', () => {
  const map = buildFixtureMap(BROKEN_SPIRE_APPROACH_V1);

  it('offers a silhouette and a bearing from world entry', () => {
    const promises = resolveLandmarkPromises(BROKEN_SPIRE_APPROACH_V1, WORLD_ENTRY);

    expect(promises).toEqual([
      { silhouetteKey: 'exploration.landmark.broken-spire.silhouette', bearing: 'SE' },
    ]);
  });

  it('carries no coordinate and no distance — only a shape and a direction', () => {
    const [promise] = resolveLandmarkPromises(BROKEN_SPIRE_APPROACH_V1, WORLD_ENTRY);

    // Design §17: "a broken vertical silhouette beyond the ridge" is allowed;
    // "Broken Spire — 11 hexes — Quest Objective" is not. Asserting on the
    // shape of the object is what makes that unrenderable rather than merely
    // discouraged.
    expect(Object.keys(promise).sort()).toEqual(['bearing', 'silhouetteKey']);
  });

  it('leaves the Spire hex UNKNOWN', () => {
    resolveLandmarkPromises(BROKEN_SPIRE_APPROACH_V1, WORLD_ENTRY);

    expect(map.getTileAt(SPIRE)?.discovery).toBe('UNKNOWN');
  });

  it('offers nothing from a hex the author did not sight it from', () => {
    expect(
      resolveLandmarkPromises(BROKEN_SPIRE_APPROACH_V1, { columnIndex: 1, rowIndex: 0 }),
    ).toEqual([]);
  });
});
