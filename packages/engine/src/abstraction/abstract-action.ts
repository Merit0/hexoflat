import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THeroToolKey } from '../content/equipment.content';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/location-key';

export type TGameEventType = 'INFO' | 'ACTION' | 'LOOT' | 'BATTLE' | 'MAP' | 'NAVIGATION';

/**
 * Structural ports the not-yet-migrated apps/web Pinia stores satisfy today.
 * They let action-starters/finishers stay framework-free while still reading
 * and mutating state that legitimately still lives in apps/web (world-map
 * combat/navigation in particular — tracked follow-up debt, see
 * docs/MIGRATION-PLAN.md Phase 2).
 */
export interface IHeroToolPort {
  isLocked: boolean;
  isDragging: boolean;
  activeTool: THeroToolKey | null;
  hover: IHexCoordinates | null;
  stoneCollected?: number;
  consumeDurability: (costPct: number) => boolean;
  lockTool: (tile: HexTileModel, endsAt: number) => void;
  unlockTool: () => void;
  clearResolvedActions: () => void;
  stopTool: () => void;
  addTreeCut?: (amount: number) => void;
  collectStones?: (amount: number) => void;
}

export interface IHeroPort {
  hero: {
    name: string;
    maxHealth: number;
    currentHealth: number;
  };
  healHero: (amount: number) => void;
}

export interface IGatheringPort {
  add: (key: THexobjectKey, amount?: number) => void;
}

export interface IInventoryPort {
  putToInventory: (key: THexobjectKey, amount?: number) => { ok: boolean; message?: string };
}

export interface IEventsPort {
  push: (actorName: string, message: string, type?: TGameEventType) => void;
}

export interface IWorldMapPort {
  combatActive: boolean;
  performHeroCombatAttack: (
    tile: HexTileModel,
    toolKey: string,
  ) => { ok: boolean; message: string };
  placeCombatDefendMarker: (target: IHexCoordinates, toolKey?: THeroToolKey | null) => boolean;
  isLocationRespawning: (locationKey: LocationKey) => boolean;
  getLocationRespawnRemainingMs: (locationKey: LocationKey) => number;
  goToLocation: (locationKey: LocationKey) => void;
}

export interface IActionContext {
  map: HexMapModel;
  now: number;
  heroToolStore: IHeroToolPort;
  hero: IHeroPort;
  gathering: IGatheringPort;
  inventory: IInventoryPort;
  events: IEventsPort;
  worldMap: IWorldMapPort;
  navigate?: (locationKey: LocationKey) => void;
}
