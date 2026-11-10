import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { HexEngineActionContext } from '@hexoflat/engine';
import { applyCommand, type HexEngineState } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { withStoreInventory } from '@/services/inventory/inventory-bridge';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { getWorldSeed } from '@/services/rng/world-rng';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { findSquad } from '@hexoflat/engine/squads/squad-state';

export type TWorldState = {
  knowledgeRevision?: number;
  contentVersion: number;
  heroCoordinates: IHexCoordinates | null;
  worldSeed?: string;
  descriptor?: BoardDescriptor | null;
  battle?: unknown;
};

export function initialLocationKey(): LocationKey {
  return 'camping';
}

export function requireWorldSeed(): string {
  const seed = getWorldSeed();
  if (!seed) throw new Error('world seed is not set before creating a board');
  return seed;
}

export const MAP_ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };

function hasPendingTake(map: HexMapModel): boolean {
  return map.tiles.some((tile) => tile.pendingAction?.type === EHexActionType.TAKE);
}

export function runWorldTick(
  map: HexMapModel,
  now: number,
  ctx: HexEngineActionContext,
  heroId?: string,
): boolean {
  const state: HexEngineState = { map, heroes: {} };
  const tick = () => applyCommand(state, { type: 'WORLD_TICK', payload: { now } }, ctx);
  const { events } =
    heroId && hasPendingTake(map) ? withStoreInventory(heroId, state, tick) : tick();
  const tickEvent = events.find((e) => e.type === 'WORLD_TICKED') as
    { type: 'WORLD_TICKED'; payload: { changed: boolean } } | undefined;

  return tickEvent?.payload.changed ?? false;
}

export function hasLegacyBattle(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const saved = raw as { engagement?: unknown; battle?: unknown };
  return !!saved.engagement || !!saved.battle;
}

export function servedEngagement(
  engagement: Engagement | null | undefined,
  map: HexMapModel | null,
): Engagement | null {
  if (!engagement || !map || !findSquad(map, engagement.squadId)) return null;
  return engagement;
}
