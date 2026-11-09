import type { DomainEvent } from '../commands/types';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { applyAggregate, toAggregate } from './inventory-adapter';
import type { ConsumeItemCommand, GrantItemCommand } from './inventory-commands';
import type { InventoryState } from './inventory-state';
import { countItem, planConsume, planGrant } from './plan-stock';

export type GrantSource = GrantItemCommand['payload']['source'];

/**
 * What an action finisher sees instead of an inventory port: the hero's state and the events
 * the finisher produced. `applyCommand` fills it from `HexEngineState.inventory` and writes the
 * result back, so a pickup or a spent scroll is one more validated change of the same state.
 */
export interface IInventoryDraft {
  current: InventoryState | undefined;
  events: DomainEvent[];
}

export interface StockResult {
  inventory: InventoryState | undefined;
  events: DomainEvent[];
  ok: boolean;
}

function grant(
  state: InventoryState | undefined,
  key: THexobjectKey,
  amount: number,
  source: GrantSource,
): StockResult {
  const heroId = state?.heroId ?? '';
  const refuse = (reason: string): StockResult => ({
    inventory: state,
    ok: false,
    events: [{ type: 'ITEM_GRANT_REJECTED', payload: { heroId, key, reason } }],
  });
  if (!state) return refuse('NO_INVENTORY');
  const seq = { next: state.idSeq };
  const plan = planGrant(toAggregate(state), key, amount, state.capacityKg, () => {
    return `${state.heroId}:${seq.next++}`;
  });
  if (!plan.ok) return refuse(plan.reason);
  const revision = state.revision + 1;
  const next = { ...applyAggregate(state, plan.next), idSeq: seq.next, revision };
  return {
    inventory: next,
    ok: true,
    events: [
      { type: 'ITEM_GRANTED', payload: { heroId, key, amount, source, placedAt: plan.placedAt } },
      { type: 'INVENTORY_CHANGED', payload: { heroId, revision } },
    ],
  };
}

function consume(
  state: InventoryState | undefined,
  key: THexobjectKey,
  amount: number,
): StockResult {
  const heroId = state?.heroId ?? '';
  const refuse = (reason: string): StockResult => ({
    inventory: state,
    ok: false,
    events: [{ type: 'ITEM_CONSUME_REJECTED', payload: { heroId, key, reason } }],
  });
  if (!state) return refuse('NO_INVENTORY');
  const plan = planConsume(toAggregate(state), key, amount);
  if (!plan.ok) return refuse(plan.reason);
  const revision = state.revision + 1;
  return {
    inventory: { ...applyAggregate(state, plan.next), revision },
    ok: true,
    events: [
      { type: 'ITEM_CONSUMED', payload: { heroId, key, amount } },
      { type: 'INVENTORY_CHANGED', payload: { heroId, revision } },
    ],
  };
}

export function grantToDraft(
  draft: IInventoryDraft,
  key: THexobjectKey,
  amount: number,
  source: GrantSource,
): boolean {
  const result = grant(draft.current, key, amount, source);
  draft.current = result.inventory;
  draft.events.push(...result.events);
  return result.ok;
}

export function consumeFromDraft(
  draft: IInventoryDraft,
  key: THexobjectKey,
  amount: number,
): boolean {
  const result = consume(draft.current, key, amount);
  draft.current = result.inventory;
  draft.events.push(...result.events);
  return result.ok;
}

export function countInDraft(draft: IInventoryDraft, key: THexobjectKey): number {
  return draft.current ? countItem(toAggregate(draft.current), key) : 0;
}

function checked(
  state: InventoryState | undefined,
  { heroId, revision }: { heroId: string; revision: number },
  rejectedType: string,
  key: string,
): StockResult | null {
  const reason = !state || state.heroId !== heroId ? 'NO_INVENTORY' : null;
  const stale = state && state.revision !== revision ? 'INVENTORY_STALE' : null;
  const why = reason ?? stale;
  if (!why) return null;
  return {
    inventory: state,
    ok: false,
    events: [{ type: rejectedType, payload: { heroId, key, reason: why } }],
  };
}

/** The public `GRANT_ITEM`: same rule as a pickup, but the caller states the revision it saw. */
export function applyGrantItem(state: InventoryState | undefined, command: GrantItemCommand) {
  const { key, amount, source } = command.payload;
  const early = checked(state, command.payload, 'ITEM_GRANT_REJECTED', key);
  return early ?? grant(state, key as THexobjectKey, amount, source);
}

export function applyConsumeItem(state: InventoryState | undefined, command: ConsumeItemCommand) {
  const { key, amount } = command.payload;
  const early = checked(state, command.payload, 'ITEM_CONSUME_REJECTED', key);
  return early ?? consume(state, key as THexobjectKey, amount);
}
