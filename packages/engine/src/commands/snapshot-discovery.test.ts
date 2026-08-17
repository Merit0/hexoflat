import { describe, expect, it } from 'vitest';
import { deserializeState, serializeState, type SnapshotPayload } from './snapshot';
import { createEngineState } from './engine-state';
import { CONTENT_VERSION } from '../content/content-version';
import { sha256Hex } from '../utils/hash/sha256';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { buildFixtureMap } from '../content/fixtures/build-fixture-map';
import { BROKEN_SPIRE_APPROACH_V1 } from '../content/fixtures/broken-spire-approach-v1';
import type { DiscoveryState } from '../map/discovery-state';

/**
 * Adding `discovery` to the save format is additive, which is the whole
 * reason `CONTENT_VERSION` stays at 1: bumping it makes `deserializeState`
 * throw `StaleSnapshotError` and discards every existing save to buy nothing.
 * That claim is only true if both paths actually work, so both are tested.
 */

const AT = { columnIndex: 1, rowIndex: 0 };

/**
 * Builds a payload the way a pre-E1 build wrote them: `isRevealed`, no
 * `discovery` key anywhere, and a checksum computed over exactly that shape.
 * Constructed by deletion from a real payload rather than hand-written, so it
 * cannot drift out of sync with the rest of the format.
 */
function preE1Payload(isRevealed: boolean): SnapshotPayload {
  const map = new HexMapBuilder().name('legacy').width(2).height(1).build();
  const state = createEngineState({ map, seed: 'legacy-save' });
  const { checksum, ...content } = serializeState(state);
  void checksum;

  content.map.tiles = content.map.tiles.map(({ discovery, ...rest }) => {
    void discovery;
    return { ...rest, isRevealed };
  });

  return { ...content, checksum: sha256Hex(JSON.stringify(content)) };
}

describe('save/load with a pre-E1 payload', () => {
  it('verifies its own checksum — the new field did not change the old hash', () => {
    expect(() => deserializeState(preE1Payload(true), Date.now())).not.toThrow();
  });

  it('reads isRevealed=true back as DISCOVERED', () => {
    const restored = deserializeState(preE1Payload(true), Date.now());

    expect(restored.map.getTileAt(AT)?.discovery).toBe('DISCOVERED');
    expect(restored.map.getTileAt(AT)?.isRevealed).toBe(true);
  });

  it('reads isRevealed=false back as UNKNOWN', () => {
    const restored = deserializeState(preE1Payload(false), Date.now());

    expect(restored.map.getTileAt(AT)?.discovery).toBe('UNKNOWN');
    expect(restored.map.getTileAt(AT)?.isRevealed).toBe(false);
  });

  it('is still content version 1', () => {
    expect(preE1Payload(true).version).toBe(CONTENT_VERSION);
    expect(CONTENT_VERSION).toBe(1);
  });
});

describe('save/load round trip with all four states', () => {
  it('restores every state exactly', () => {
    const map = new HexMapBuilder().name('four-states').width(4).height(1).build();
    const states: DiscoveryState[] = ['UNKNOWN', 'OBSERVED', 'DISCOVERED', 'UNDERSTOOD'];
    states.forEach((state, columnIndex) => {
      map.getTileAt({ columnIndex, rowIndex: 0 })!.discovery = state;
    });

    const restored = deserializeState(serializeState(createEngineState({ map, seed: 'rt' })), 0);

    states.forEach((state, columnIndex) => {
      expect(restored.map.getTileAt({ columnIndex, rowIndex: 0 })?.discovery).toBe(state);
    });
  });

  it('survives a round trip of the whole slice fixture', () => {
    const map = buildFixtureMap(BROKEN_SPIRE_APPROACH_V1);
    const before = map.tiles.map((tile) => tile.discovery);

    const restored = deserializeState(
      serializeState(createEngineState({ map, seed: BROKEN_SPIRE_APPROACH_V1.worldSeed })),
      0,
    );

    expect(restored.map.tiles.map((tile) => tile.discovery)).toEqual(before);
    // Specifically the two states the boolean could not have carried.
    expect(restored.map.getTileAt({ columnIndex: 2, rowIndex: 1 })?.discovery).toBe('UNDERSTOOD');
    expect(restored.map.getTileAt({ columnIndex: 4, rowIndex: 2 })?.discovery).toBe('OBSERVED');
  });

  it('round-trips through the raw map JSON too', () => {
    const map = buildFixtureMap(BROKEN_SPIRE_APPROACH_V1);

    const raw = JSON.parse(JSON.stringify(map.toJSON())) as ISerializedHexMap;
    const rebuilt = HexMapModel.fromJSON(raw, 0);

    expect(rebuilt.getTileAt({ columnIndex: 2, rowIndex: 1 })?.discovery).toBe('UNDERSTOOD');
    expect(rebuilt.getTileAt({ columnIndex: 3, rowIndex: 2 })?.discovery).toBe('OBSERVED');
    expect(rebuilt.getTileAt({ columnIndex: 9, rowIndex: 4 })?.discovery).toBe('UNKNOWN');
  });
});

describe('session features are not part of the save', () => {
  it('never writes them into the payload', () => {
    const map = new HexMapBuilder().name('features').width(1).height(1).build();
    const payload = serializeState(
      createEngineState({ map, seed: 'features', features: { explorationSlice: true } }),
    );

    expect(JSON.stringify(payload)).not.toContain('explorationSlice');
  });

  it('restores with the slice off unless the session asks for it', () => {
    const map = new HexMapBuilder().name('features').width(1).height(1).build();
    const payload = serializeState(
      createEngineState({ map, seed: 'features', features: { explorationSlice: true } }),
    );

    // A save must not be able to switch a rule on for a session that did not
    // ask for it — which is why `features` is an argument, not a field.
    expect(deserializeState(payload, 0).features.explorationSlice).toBe(false);
    expect(deserializeState(payload, 0, { explorationSlice: true }).features.explorationSlice).toBe(
      true,
    );
  });
});
