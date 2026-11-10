import { describe, expect, it } from 'vitest';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { findEntryHex } from './hero-placement';

const never = () => 0;

describe('hero placement', () => {
  const silesia = MapRegistry.get('silesia').create({ seed: '' }).map;
  const north = MapRegistry.get('silesia-north').create({ seed: '' }).map;

  it('findEntryHex stands beside the entry object when the location has one', () => {
    const spot = findEntryHex(silesia, 'silesia', never)!;
    const entry = silesia.tiles.find(
      (tile) => tile.hexobject?.hexobjectKey === 'camping-entrance',
    )!;

    expect(hexDistance(spot, entry.coordinates)).toBe(1);
  });

  it('findEntryHex falls back to an exit for a location with no entry object', () => {
    const spot = findEntryHex(north, 'silesia-north', never)!;
    const exit = north.tiles.find((tile) => tile.exit)!;

    expect(hexDistance(spot, exit.coordinates)).toBeLessThanOrEqual(1);
  });
});
