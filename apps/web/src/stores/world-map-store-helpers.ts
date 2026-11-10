import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { getWorldSeed } from '@/services/rng/world-rng';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { findSquad } from '@hexoflat/engine/squads/squad-state';

export function initialLocationKey(): LocationKey {
  return 'camping';
}

export function requireWorldSeed(): string {
  const seed = getWorldSeed();
  if (!seed) throw new Error('world seed is not set before creating a board');
  return seed;
}

export const MAP_ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };

export function servedEngagement(
  engagement: Engagement | null | undefined,
  map: HexMapModel | null,
): Engagement | null {
  if (!engagement || !map || !findSquad(map, engagement.squadId)) return null;
  return engagement;
}
