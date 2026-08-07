import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { CONTENT_VERSION } from '../content/content-version';
import type { HeroState } from '../hero-movement/hero-state';
import type { HexEngineState } from './apply-command';
import {
  deserializeState,
  serializeState,
  SnapshotChecksumError,
  StaleSnapshotError,
} from './snapshot';

function buildState(): HexEngineState {
  const map = new HexMapBuilder().name('snapshot-test').width(2).height(2).build();
  const tile = map.tiles[0];
  tile.isRevealed = true;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);

  const hero: HeroState = {
    id: 'hero-1',
    controlledBy: 'user-1',
    coordinates: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 3,
  };

  return { map, heroes: { [hero.id]: hero } };
}

describe('snapshot: serializeState / deserializeState', () => {
  it('round-trips map and heroes', () => {
    const state = buildState();

    const payload = serializeState(state);
    const restored = deserializeState(payload, 0);

    expect(restored.map.toJSON()).toEqual(state.map.toJSON());
    expect(restored.heroes).toEqual(state.heroes);
  });

  it('stamps the current content version on the payload', () => {
    const payload = serializeState(buildState());

    expect(payload.version).toBe(CONTENT_VERSION);
  });

  it('stamps a checksum that changes if the content differs', () => {
    const payloadA = serializeState(buildState());

    const otherState = buildState();
    otherState.heroes['hero-1'].heroSteps = 99;
    const payloadB = serializeState(otherState);

    expect(payloadA.checksum).toHaveLength(64);
    expect(payloadA.checksum).not.toBe(payloadB.checksum);
  });

  it('throws StaleSnapshotError when the payload version does not match CONTENT_VERSION', () => {
    const payload = serializeState(buildState());
    const stale = { ...payload, version: payload.version - 1 };

    expect(() => deserializeState(stale, 0)).toThrow(StaleSnapshotError);
  });

  it('throws SnapshotChecksumError when the checksum does not match the content', () => {
    const payload = serializeState(buildState());
    const tampered = { ...payload, checksum: 'not-a-real-checksum' };

    expect(() => deserializeState(tampered, 0)).toThrow(SnapshotChecksumError);
  });
});
