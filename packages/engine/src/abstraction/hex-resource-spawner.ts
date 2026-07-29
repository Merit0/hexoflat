import { HexObjectPlacementRef } from './hex-map-placement';

export interface IHexResourceSpawner {
  proto: HexObjectPlacementRef;
  regrowMs: number;
  nextSpawnAt: number | null;
  enabled: boolean;
}
