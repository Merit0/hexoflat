import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import type { HeroState } from '../hero-movement/hero-state';
import { CONTENT_VERSION } from '../content/content-version';
import { sha256Hex } from '../utils/hash/sha256';
import { createRngState, type RngState } from '../utils/seeded-random';
import type { AppliedCommandLog } from './applied-command-log';
import { NO_ENGINE_FEATURES, type EngineFeatureSet, type HexEngineState } from './engine-state';

export interface SnapshotPayload {
  version: number;
  map: ISerializedHexMap;
  heroes: Record<string, HeroState>;
  /**
   * Added in E0. Absent in every payload written before it, which is why
   * this is optional and CONTENT_VERSION stayed at 1: bumping the version
   * would have thrown `StaleSnapshotError` and wiped every existing save to
   * buy nothing. A payload without it is restored with a fresh sequence
   * seeded from its own checksum — deterministic, and different per save.
   */
  rngState?: RngState;
  /**
   * Added in E0 alongside `rngState`, and optional for the same reason. A
   * pre-E0 payload restores at version 0 with an empty log: nothing that was
   * applied before the snapshot can be retried across it anyway, since the
   * ids were never recorded.
   */
  stateVersion?: number;
  appliedCommands?: AppliedCommandLog;
  /** SHA-256 of every content key the payload carries. */
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

type SnapshotContent = Omit<SnapshotPayload, 'checksum'>;

/**
 * Hashes exactly the keys the payload carries. `JSON.stringify` drops an
 * `undefined` value, so a pre-E0 payload (no `rngState` key at all) and a
 * payload whose `rngState` is explicitly undefined hash identically — which
 * is what lets old saves keep verifying against the checksum they were
 * written with.
 */
function computeChecksum(content: SnapshotContent): string {
  return sha256Hex(JSON.stringify(content));
}

export function serializeState(state: HexEngineState): SnapshotPayload {
  const content: SnapshotContent = {
    version: CONTENT_VERSION,
    map: state.map.toJSON(),
    heroes: state.heroes,
    rngState: state.rngState,
    stateVersion: state.stateVersion,
    appliedCommands: state.appliedCommands,
  };

  return { ...content, checksum: computeChecksum(content) };
}

/**
 * `features` is an argument rather than a payload field on purpose: which
 * slice rules are live is a property of *this session*, not of the save. A
 * snapshot that could switch a rule on would let an old file change how the
 * engine behaves. Omitted means everything off.
 */
export function deserializeState(
  payload: SnapshotPayload,
  now: number,
  features: EngineFeatureSet = NO_ENGINE_FEATURES,
): HexEngineState {
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
    // A payload written before E0 has no sequence to resume. Seeding from its
    // checksum keeps the restore deterministic (the same old save always
    // reloads into the same sequence) without colliding across saves.
    rngState: payload.rngState ?? createRngState(payload.checksum),
    stateVersion: payload.stateVersion ?? 0,
    appliedCommands: payload.appliedCommands ?? [],
    features: { ...features },
  };
}
