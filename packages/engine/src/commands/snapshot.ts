import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import type { HeroState } from '../hero-movement/hero-state';
import type { HexEngineState } from './apply-command';

export interface SnapshotPayload {
  version: number;
  map: ISerializedHexMap;
  heroes: Record<string, HeroState>;
}

export function serializeState(state: HexEngineState): SnapshotPayload {
  return {
    version: 1,
    map: state.map.toJSON(),
    heroes: state.heroes,
  };
}

export function deserializeState(payload: SnapshotPayload): HexEngineState {
  return {
    map: HexMapModel.fromJSON(payload.map),
    heroes: payload.heroes,
  };
}
