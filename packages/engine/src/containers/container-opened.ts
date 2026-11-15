import type { LootDrop } from '../loot';
import type { Axial } from '../utils/hex-utils';
import type { ContainerKind } from './container';

export const CONTAINER_OPENED = 'CONTAINER_OPENED';

export interface ContainerOpenedPlacement {
  hex: Axial;
  itemKey: LootDrop['itemKey'];
  amount: number;
}

export interface ContainerOpenedPayload {
  actorId: string;
  containerId: string;
  kind: ContainerKind;
  hex: Axial;
  from: Axial;
  placed: ContainerOpenedPlacement[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
  nothing: boolean;
}

export interface SpaceOpened {
  from: Axial;
  placed: ContainerOpenedPlacement[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
}

export interface SpaceApplied {
  opened: SpaceOpened | null;
  events: DomainEvent[];
}

import type { DomainEvent } from '../commands/types';
