import { describe, expect, it } from 'vitest';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { findArrivalHex, findEntryHex } from './hero-placement';

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

  it('findArrivalHex puts the hero beside the exit on the arrival side and is null without one', () => {
    const spot = findArrivalHex(north, 'S', never)!;

    expect(hexDistance(spot, north.tiles.find((tile) => tile.exit === 'S')!.coordinates)).toBe(1);
    expect(findArrivalHex(north, null, never)).toBeNull();
    expect(findArrivalHex(north, 'W', never)).toBeNull();
    expect(findArrivalHex(null, 'S', never)).toBeNull();
  });
});
