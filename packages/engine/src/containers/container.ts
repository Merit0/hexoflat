import type { LootDrop } from '../loot';
import type { Axial } from '../utils/hex-utils';

export type ContainerKind = 'chest' | 'grave' | 'quest-chest';
export type ContainerStatus = 'full' | 'empty';

export interface ContainerState {
  readonly id: string;
  readonly kind: ContainerKind;
  readonly at: Axial;
  readonly contents: readonly LootDrop[] | null;
  readonly status: ContainerStatus;
}

export type ContainerRefusal =
  'STANDING_ON_TARGET' | 'CONTAINER_EMPTY' | 'NOT_ADJACENT' | 'NO_ROOM_FOR_LOOT' | 'BAG_FULL';

export type AccessRefusal = Extract<
  ContainerRefusal,
  'STANDING_ON_TARGET' | 'CONTAINER_EMPTY' | 'NOT_ADJACENT'
>;
