import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { HexEngineActionContext } from '@hexoflat/engine';
import { applyCommand, type HexEngineState } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { withStoreInventory } from '@/services/inventory/inventory-bridge';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { getWorldSeed } from '@/services/rng/world-rng';
import { battleStateSchema } from '@hexoflat/engine/battle/battle-state';
import { engagementSchema } from '@hexoflat/engine/squads/engagement';
import { findSquad } from '@hexoflat/engine/squads/squad-state';
import type { BattleSnapshot } from '@/stores/battle-store';

export type TWorldState = {
  knowledgeRevision?: number;
  contentVersion: number;
  heroCoordinates: IHexCoordinates | null;
  worldSeed?: string;
  descriptor?: BoardDescriptor | null;
  battle?: BattleSnapshot;
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

let isHydratingFromStorage = false;

export function isCurrentlyHydratingFromStorage(): boolean {
  return isHydratingFromStorage;
}

export function withoutBattleAutosave(hydrate: () => void): void {
  isHydratingFromStorage = true;
  try {
    hydrate();
  } finally {
    isHydratingFromStorage = false;
  }
}

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

export function readBattleSnapshot(raw: unknown, map: HexMapModel | null): BattleSnapshot {
  const empty: BattleSnapshot = { engagement: null, battle: null };
  if (!raw || typeof raw !== 'object' || !map) return empty;
  const saved = raw as Record<string, unknown>;
  const engagement = engagementSchema.safeParse(saved.engagement);
  if (!engagement.success || !findSquad(map, engagement.data.squadId)) return empty;
  const battle = battleStateSchema.safeParse(saved.battle);
  return { engagement: engagement.data, battle: battle.success ? battle.data : null };
}
