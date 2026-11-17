import { z } from 'zod';
import type { LootDrop } from '../loot';
import { tokenEntryIssue } from '../tokens/token-entry';
import { itemTokenSchema } from '../tokens/token-schema';
import type { Axial } from '../utils/hex-utils';

export type LootLists = LootDrop[][];

export type ContainerKind = 'chest' | 'grave' | 'quest-chest';
export type ContainerStatus = 'full' | 'empty';

export interface ContainerState {
  readonly id: string;
  readonly kind: ContainerKind;
  readonly at: Axial;
  readonly contents: LootLists | null;
  readonly status: ContainerStatus;
}

export type ContainerRefusal =
  'STANDING_ON_TARGET' | 'CONTAINER_EMPTY' | 'NOT_ADJACENT' | 'NO_ROOM_FOR_LOOT' | 'BAG_FULL';

export type AccessRefusal = Extract<
  ContainerRefusal,
  'STANDING_ON_TARGET' | 'CONTAINER_EMPTY' | 'NOT_ADJACENT'
>;

function tokenFits(drop: LootDrop): boolean {
  if (drop.token === undefined) return true;
  return (
    itemTokenSchema.safeParse(drop.token).success && tokenEntryIssue(drop, drop.itemKey) === null
  );
}

const lootDropSchema = z.custom<LootDrop>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LootDrop).itemKey === 'string' &&
    (value as LootDrop).itemKey.length > 0 &&
    Number.isInteger((value as LootDrop).amount) &&
    (value as LootDrop).amount >= 1 &&
    typeof (value as LootDrop).guaranteed === 'boolean' &&
    tokenFits(value as LootDrop),
);

export const containerStateSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['chest', 'grave', 'quest-chest']),
  at: z.object({ q: z.number().int(), r: z.number().int() }),
  contents: z.array(z.array(lootDropSchema)).nullable(),
  status: z.enum(['full', 'empty']),
});

export function emptiedContainer(container: ContainerState): ContainerState {
  return { ...container, contents: [], status: 'empty' };
}
