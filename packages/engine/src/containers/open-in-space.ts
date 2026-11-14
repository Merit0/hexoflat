import type { DomainEvent } from '../commands/types';
import type { IInventoryDraft } from '../inventory/apply-stock';
import type { LootDrop, LootNeighbour } from '../loot';
import type { Axial } from '../utils/hex-utils';
import type { ContainerRefusal, ContainerState } from './container';
import { accessRefusal, openContainer, type OpenOutcome } from './open-container';

export interface ContainerPrice {
  check(): DomainEvent[] | null;
  spend(): DomainEvent[];
}

export interface ContainerSpace<S, T, R extends string> {
  preconditions(state: S, actorId: string): R | null;
  actorAt(state: S, actorId: string): Axial;
  standsOnContainer(state: S, actorId: string): boolean;
  containerAt(state: S, target: T): ContainerState | null;
  neighbours(state: S, container: ContainerState): readonly LootNeighbour[];
  rollContents(state: S, container: ContainerState): LootDrop[];
  apply(
    state: S,
    actorId: string,
    container: ContainerState,
    outcome: Extract<OpenOutcome, { ok: true }>,
    bag: IInventoryDraft,
  ): DomainEvent[];
  refusalEvents(state: S, actorId: string, target: T, reason: R | ContainerRefusal): DomainEvent[];
}

export type OpenInSpaceResult<R extends string> =
  | { ok: true; events: DomainEvent[] }
  | { ok: false; reason: R | ContainerRefusal | null; events: DomainEvent[] };

export function openInSpace<S, T, R extends string>(
  space: ContainerSpace<S, T, R>,
  state: S,
  actorId: string,
  target: T,
  bag: IInventoryDraft,
  price?: ContainerPrice,
): OpenInSpaceResult<R> {
  const precondition = space.preconditions(state, actorId);
  if (precondition) {
    return {
      ok: false,
      reason: precondition,
      events: space.refusalEvents(state, actorId, target, precondition),
    };
  }
  const actorAt = space.actorAt(state, actorId);
  const standing = space.standsOnContainer(state, actorId);
  const container = space.containerAt(state, target);
  const access = container
    ? accessRefusal({ actorAt, standing, container })
    : standing
      ? 'STANDING_ON_TARGET'
      : 'CONTAINER_EMPTY';
  if (access || !container) {
    const reason = access ?? 'CONTAINER_EMPTY';
    return { ok: false, reason, events: space.refusalEvents(state, actorId, target, reason) };
  }
  const contents = container.contents ?? space.rollContents(state, container);
  const outcome = openContainer({
    actorAt,
    standing,
    container,
    contents,
    neighbours: space.neighbours(state, container),
    bag,
  });
  if (!outcome.ok) {
    return {
      ok: false,
      reason: outcome.reason,
      events: space.refusalEvents(state, actorId, target, outcome.reason),
    };
  }
  const refused = price?.check() ?? null;
  if (refused) return { ok: false, reason: null, events: refused };
  const paid = price ? price.spend() : [];
  return { ok: true, events: [...paid, ...space.apply(state, actorId, container, outcome, bag)] };
}
