import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import type { HeroState } from '../hero-movement/hero-state';
import { CONTENT_VERSION } from '../content/content-version';
import { sha256Hex } from '../utils/hash/sha256';
import type { HexEngineState } from './apply-command';

export interface SnapshotPayload {
  version: number;
  map: ISerializedHexMap;
  heroes: Record<string, HeroState>;
  /** SHA-256 of `{ version, map, heroes }`, checked in `deserializeState`. */
  checksum: string;
}

/** Thrown by `deserializeState` — never partially deserializes a bad payload. */
export class StaleSnapshotError extends Error {
  constructor(
    public readonly payloadVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(
      `Stale snapshot: payload is content version ${payloadVersion}, engine expects ${expectedVersion}.`,
    );
    this.name = 'StaleSnapshotError';
  }
}

export class SnapshotChecksumError extends Error {
  constructor() {
    super('Snapshot checksum mismatch — refusing to deserialize a possibly corrupted payload.');
    this.name = 'SnapshotChecksumError';
  }
}

function computeChecksum(content: {
  version: number;
  map: ISerializedHexMap;
  heroes: Record<string, HeroState>;
}): string {
  return sha256Hex(JSON.stringify(content));
}

export function serializeState(state: HexEngineState): SnapshotPayload {
  const content = { version: CONTENT_VERSION, map: state.map.toJSON(), heroes: state.heroes };
  return { ...content, checksum: computeChecksum(content) };
}

export function deserializeState(payload: SnapshotPayload, now: number): HexEngineState {
  if (payload.version !== CONTENT_VERSION) {
    throw new StaleSnapshotError(payload.version, CONTENT_VERSION);
  }

  const { checksum, ...content } = payload;
  if (computeChecksum(content) !== checksum) {
    throw new SnapshotChecksumError();
  }

  return {
    map: HexMapModel.fromJSON(payload.map, now),
    heroes: payload.heroes,
  };
}
