import type { DomainEvent } from '../commands/types';
import type { IInventoryDraft } from '../inventory/apply-stock';
import type { LootNeighbour } from '../loot';
import type { Axial } from '../utils/hex-utils';
import type { ContainerRefusal, ContainerState, LootLists } from './container';
import { CONTAINER_OPENED, type SpaceApplied } from './container-opened';
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
  rollContents(state: S, container: ContainerState): LootLists;
  apply(
    state: S,
    actorId: string,
    container: ContainerState,
    outcome: Extract<OpenOutcome, { ok: true }>,
    bag: IInventoryDraft,
  ): SpaceApplied;
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
  const applied = space.apply(state, actorId, container, outcome, bag);
  const opened: DomainEvent[] = applied.opened
    ? [
        {
          type: CONTAINER_OPENED,
          payload: {
            actorId,
            containerId: container.id,
            kind: container.kind,
            hex: { ...container.at },
            from: { ...applied.opened.from },
            placed: applied.opened.placed,
            toBag: applied.opened.toBag,
            nothing: outcome.nothing,
          },
        },
      ]
    : [];
  return { ok: true, events: [...paid, ...opened, ...applied.events] };
}
