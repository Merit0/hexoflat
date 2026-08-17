import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { CONTENT_VERSION } from '../content/content-version';
import type { HeroState } from '../hero-movement/hero-state';
import { createEngineState, type HexEngineState } from './apply-command';
import { sha256Hex } from '../utils/hash/sha256';
import {
  deserializeState,
  serializeState,
  SnapshotChecksumError,
  StaleSnapshotError,
  type SnapshotPayload,
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

  return createEngineState({ map, heroes: { [hero.id]: hero }, seed: 'snapshot-test' });
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

  it('round-trips rngState so the sequence resumes where it left off', () => {
    const state = buildState();
    state.rngState.cursor = 17;

    const restored = deserializeState(serializeState(state), 0);

    expect(restored.rngState).toEqual({ seed: state.rngState.seed, cursor: 17 });
  });
});

/**
 * `rngState` was added to the payload in E0 without bumping CONTENT_VERSION,
 * on the grounds that the change is additive. That claim is only true if a
 * payload written before E0 still verifies and still loads — which is what
 * these pin. A regression here silently wipes every existing save.
 */
describe('snapshot: payloads written before rngState existed', () => {
  /** Strips every key E0 added and re-checksums, reproducing a pre-E0 payload. */
  function toLegacyPayload(payload: SnapshotPayload): SnapshotPayload {
    const content = {
      version: payload.version,
      map: payload.map,
      heroes: payload.heroes,
    };

    return { ...content, checksum: sha256Hex(JSON.stringify(content)) };
  }

  function buildLegacyPayload(): SnapshotPayload {
    // Exactly the shape the old serializer wrote: none of the E0 keys, and a
    // checksum computed over what remains.
    return toLegacyPayload(serializeState(buildState()));
  }

  it('still passes the checksum check', () => {
    expect(() => deserializeState(buildLegacyPayload(), 0)).not.toThrow();
  });

  it('loads with a fresh sequence rather than being discarded', () => {
    const restored = deserializeState(buildLegacyPayload(), 0);

    expect(restored.rngState.cursor).toBe(0);
    expect(restored.rngState.seed).toHaveLength(64);
  });

  it('seeds the same old save identically every time it is loaded', () => {
    const payload = buildLegacyPayload();

    expect(deserializeState(payload, 0).rngState).toEqual(deserializeState(payload, 0).rngState);
  });

  it('gives two different old saves two different seeds', () => {
    const a = buildLegacyPayload();
    const otherState = buildState();
    otherState.heroes['hero-1'].heroSteps = 99;
    const b = toLegacyPayload(serializeState(otherState));

    expect(deserializeState(a, 0).rngState.seed).not.toBe(deserializeState(b, 0).rngState.seed);
  });

  it('keeps CONTENT_VERSION at 1 — a bump here wipes every save', () => {
    expect(CONTENT_VERSION).toBe(1);
  });
});
