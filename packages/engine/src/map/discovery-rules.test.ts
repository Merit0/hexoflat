import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { getOddQNeighbors, coordinateKey } from '../utils/hex-utils';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { revealAroundHero } from './fog-service';
import {
  applyPathDiscovery,
  applyStepDiscovery,
  categorizeForObservation,
} from './discovery-rules';
import type HexMapModel from './models/hex-map-model';

const CENTER = { columnIndex: 2, rowIndex: 2 };

function buildMap(): HexMapModel {
  return new HexMapBuilder().name('discovery-test').width(5).height(5).build();
}

describe('applyStepDiscovery (design §9, §35.3)', () => {
  it('discovers the entered hex and only observes its neighbours', () => {
    const map = buildMap();

    applyStepDiscovery(map, CENTER);

    expect(map.getTileAt(CENTER)?.discovery).toBe('DISCOVERED');
    for (const neighbor of getOddQNeighbors(CENTER)) {
      expect(map.getTileAt(neighbor)?.discovery, coordinateKey(neighbor)).toBe('OBSERVED');
    }
  });

  it('is not revealAroundHero — that one still reveals all seven equally', () => {
    // The existing world maps depend on this difference staying a difference.
    // `revealAroundHero` is untouched by E1 and must keep flattening the
    // hero's hex and its six neighbours into the same state.
    const map = buildMap();

    revealAroundHero(map, CENTER);

    expect(map.getTileAt(CENTER)?.discovery).toBe('DISCOVERED');
    for (const neighbor of getOddQNeighbors(CENTER)) {
      expect(map.getTileAt(neighbor)?.discovery).toBe('DISCOVERED');
    }
  });

  it('emits one event per hex that actually changed', () => {
    const map = buildMap();

    const events = applyStepDiscovery(map, CENTER);

    expect(events.filter((event) => event.type === 'HEX_DISCOVERED')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'HEX_OBSERVED')).toHaveLength(6);
  });

  it('says nothing the second time — a re-crossed hex is not re-discovered', () => {
    const map = buildMap();
    applyStepDiscovery(map, CENTER);

    expect(applyStepDiscovery(map, CENTER)).toEqual([]);
  });

  it('promotes an already-observed hex when the hero walks into it', () => {
    const map = buildMap();
    const [firstNeighbor] = getOddQNeighbors(CENTER);
    applyStepDiscovery(map, CENTER);

    const events = applyStepDiscovery(map, firstNeighbor);

    expect(map.getTileAt(firstNeighbor)?.discovery).toBe('DISCOVERED');
    expect(events.some((event) => event.type === 'HEX_DISCOVERED')).toBe(true);
  });

  it('never demotes a hex the observation ring sweeps back over (I10)', () => {
    const map = buildMap();
    const [firstNeighbor] = getOddQNeighbors(CENTER);
    applyStepDiscovery(map, CENTER);
    applyStepDiscovery(map, firstNeighbor);

    // Walking back: CENTER is a neighbour of `firstNeighbor`, so the ring
    // touches it again — as OBSERVED, which it already outranks.
    applyStepDiscovery(map, firstNeighbor);

    expect(map.getTileAt(CENTER)?.discovery).toBe('DISCOVERED');
  });

  it('stops at the edge of the technical grid instead of inventing hexes', () => {
    const map = buildMap();
    const corner = { columnIndex: 0, rowIndex: 0 };

    const events = applyStepDiscovery(map, corner);
    const observed = events.filter((event) => event.type === 'HEX_OBSERVED');

    // Only the neighbours that were generated exist to be observed — which is
    // what makes the frontier stop organically rather than at an array bound.
    expect(observed.length).toBeLessThan(6);
    expect(observed.length).toBeGreaterThan(0);
  });

  it('does nothing for a hex the map does not have', () => {
    const map = buildMap();

    expect(applyStepDiscovery(map, { columnIndex: 99, rowIndex: 99 })).toEqual([]);
  });
});

describe('observation does not leak content (I3)', () => {
  it('reports a category, never a hexobject key', () => {
    const map = buildMap();
    const [neighbor] = getOddQNeighbors(CENTER);
    const tile = map.getTileAt(neighbor);
    if (tile) tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, neighbor);

    const events = applyStepDiscovery(map, CENTER);
    const observed = events.find(
      (event) =>
        event.type === 'HEX_OBSERVED' &&
        coordinateKey(event.payload.coordinates) === coordinateKey(neighbor),
    );

    expect(observed).toBeDefined();
    const serialized = JSON.stringify(observed);
    expect(serialized).not.toContain(HEXOBJECT_KEYS.TREE);
    expect(serialized).toMatch(/GROWTH|OBSTACLE|STRUCTURE|PRESENCE|OPEN_GROUND/);
  });

  it('categorises by what a distant look would tell you', () => {
    const map = buildMap();
    const tile = map.getTileAt(CENTER);
    if (!tile) throw new Error('missing tile');

    expect(categorizeForObservation(tile)).toBe('OPEN_GROUND');

    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, CENTER);
    expect(categorizeForObservation(tile)).toBe('GROWTH');

    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, CENTER);
    expect(categorizeForObservation(tile)).toBe('PRESENCE');
  });
});

describe('applyPathDiscovery', () => {
  it('walks the whole path in step order', () => {
    const map = buildMap();
    const path = [{ columnIndex: 1, rowIndex: 1 }, { columnIndex: 2, rowIndex: 1 }, CENTER];

    applyPathDiscovery(map, path);

    for (const coordinates of path) {
      expect(map.getTileAt(coordinates)?.discovery).toBe('DISCOVERED');
    }
  });
});
