import type { IInventoryDraft } from '../inventory/apply-stock';
import { planLootSpread, type LootNeighbour, type LootSpreadPlan } from '../loot';
import type { Axial } from '../utils/hex-utils';
import type { AccessRefusal, ContainerRefusal, ContainerState, LootLists } from './container';

export interface AccessInput {
  actorAt: Axial;
  standing: boolean;
  container: ContainerState;
}

export interface OpenInput extends AccessInput {
  contents: LootLists;
  neighbours: readonly LootNeighbour[];
  bag: IInventoryDraft;
}

export type OpenOutcome =
  | { ok: true; nothing: boolean; plan: LootSpreadPlan; container: ContainerState }
  | { ok: false; reason: ContainerRefusal };

function axialDistance(from: Axial, to: Axial): number {
  const dq = from.q - to.q;
  const dr = from.r - to.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function accessRefusal(input: AccessInput): AccessRefusal | null {
  if (input.standing) return 'STANDING_ON_TARGET';
  if (input.container.status === 'empty') return 'CONTAINER_EMPTY';
  return axialDistance(input.actorAt, input.container.at) === 1 ? null : 'NOT_ADJACENT';
}

export function openContainer(input: OpenInput): OpenOutcome {
  const refusal = accessRefusal(input);
  if (refusal) return { ok: false, reason: refusal };
  const spread = planLootSpread({
    target: input.container.at,
    entry: input.actorAt,
    neighbours: input.neighbours,
    lists: input.contents,
    bag: input.bag,
  });
  if (!spread.ok) return { ok: false, reason: spread.reason };
  const nothing = spread.plan.placements.length === 0 && spread.plan.toBag.length === 0;
  return {
    ok: true,
    nothing,
    plan: spread.plan,
    container: { ...input.container, status: 'empty' },
  };
}
