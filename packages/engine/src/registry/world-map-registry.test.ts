import { describe, expect, it } from 'vitest';
import { initFog } from '../map/fog-service';
import { MapRegistry } from './world-map-registry';
import { LOCATION_KEYS } from './location-key';

describe('MapRegistry', () => {
  it('camping creates a STATIC board with a stable drawingHash', () => {
    const { map, descriptor } = MapRegistry.get('camping').create({ seed: 'unused' });

    expect(descriptor).toMatchObject({ kind: 'STATIC', id: 'camping' });
    expect(descriptor.kind === 'STATIC' && descriptor.drawingHash).toBeTruthy();
    expect(map.tiles.length).toBeGreaterThan(0);
  });

  it('every built board matches its registered fogPolicy', () => {
    for (const key of ['camping', 'silesia', 'cave'] as const) {
      const def = MapRegistry.get(key);
      const { map } = def.create({ seed: 'seed' });
      expect(map.fogPolicy).toBe(def.fogPolicy);
    }
  });

  it('camping is ALL_REVEALED, so every tile starts revealed', () => {
    const { map } = MapRegistry.get('camping').create({ seed: 'unused' });

    initFog(map);
    expect(map.tiles.every((tile) => tile.isRevealed)).toBe(true);
  });

  it('silesia creates a STATIC board with a stable drawingHash', () => {
    const { descriptor } = MapRegistry.get('silesia').create({ seed: 'unused' });

    expect(descriptor).toMatchObject({ kind: 'STATIC', id: 'silesia' });
    expect(descriptor.kind === 'STATIC' && descriptor.drawingHash).toBeTruthy();
  });

  it('cave creates a DUNGEON board deterministically from the given seed', () => {
    const first = MapRegistry.get('cave').create({ seed: 'seed-a' });
    const second = MapRegistry.get('cave').create({ seed: 'seed-a' });
    const third = MapRegistry.get('cave').create({ seed: 'seed-b' });

    expect(first.descriptor).toEqual(second.descriptor);
    expect(first.descriptor).not.toEqual(third.descriptor);
    expect(first.map.tiles.length).toBeGreaterThan(0);
  });

  it('every registered boardKind produces the matching descriptor kind', () => {
    const expectedKind = { STATIC: 'STATIC', DUNGEON: 'RECIPE' } as const;
    for (const key of ['camping', 'silesia', 'cave'] as const) {
      const def = MapRegistry.get(key);
      const { descriptor } = def.create({ seed: 'seed' });
      expect(descriptor.kind).toBe(expectedKind[def.boardKind]);
    }
  });

  it('cave passes encounter params to the recipe descriptor', () => {
    const { descriptor } = MapRegistry.get('cave').create({ seed: 'seed', params: { tier: 3 } });
    expect(descriptor.kind === 'RECIPE' && descriptor.params).toEqual({ tier: 3 });
  });
});

describe('MapRegistry covers every location key', () => {
  it('has a definition whose key matches, for each key in LOCATION_KEYS', () => {
    for (const key of LOCATION_KEYS) expect(MapRegistry.get(key).key).toBe(key);
  });

  it('builds each static location from a recipe whose id is the location key', () => {
    for (const key of LOCATION_KEYS) {
      const def = MapRegistry.get(key);
      if (def.boardKind !== 'STATIC') continue;
      expect(def.staticDrawing?.id).toBe(key);
      const { descriptor } = def.create({ seed: 'any' });
      expect(descriptor).toMatchObject({ kind: 'STATIC', id: key });
    }
  });

  it('silesia-north has no entry object, so heroes are placed by its exit', () => {
    expect(MapRegistry.get('silesia-north').entryHexobjectKey).toBeUndefined();
  });
});
