import type { DomainEvent } from '../commands/types';
import { lootTableOf } from '../content/loot-tables.content';
import type { IInventoryDraft } from '../inventory/apply-stock';
import {
  applySpreadPlan,
  lootNeighbours,
  pickupStack,
  planLootSpread,
  rollLootLists,
  type LootDrop,
  type LootNeighbour,
} from '../loot';
import { lootTableIdOfKind } from './battle-catalogue';
import { isAlive, isFreeHex } from './battle-board';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleHex, BattleState, CollectState, Grave } from './battle-state';
import { hexKey, isAdjacentHex, sameHex } from './hex-battle-geom';
import { reject, type BattleRejection } from './battle-rejection';

export interface CollectContext {
  inventory?: IInventoryDraft;
}

export const COLLECT_ACTION_KINDS: ReadonlySet<BattleAction['kind']> = new Set([
  'move',
  'loot-grave',
  'pickup-loot',
]);

export function inCollectPhase(state: BattleState): boolean {
  return state.phase === 'ended' && state.outcome === 'victory' && !!state.collect;
}

export function lootLeft(collect: CollectState): boolean {
  return collect.items.length > 0 || collect.graves.some((grave) => !grave.examined);
}

export function graveAt(collect: CollectState, hex: BattleHex): Grave | null {
  return collect.graves.find((grave) => sameHex(grave.hex, hex)) ?? null;
}

function deathOrder(state: BattleState, dead: BattleCreature[]): BattleCreature[] {
  const order = new Map((state.fallen ?? []).map((id, index) => [id, index]));
  const rank = (creature: BattleCreature) => order.get(creature.id) ?? Number.MAX_SAFE_INTEGER;
  return [...dead].sort((a, b) => rank(a) - rank(b));
}

export function enterCollectPhase(state: BattleState): DomainEvent[] {
  const dead = state.creatures.filter((c) => c.side === 'enemies' && !isAlive(c));
  const graves: Grave[] = [];
  for (const creature of deathOrder(state, dead)) {
    const tableId = lootTableIdOfKind(creature.kind);
    const tables = tableId ? [tableId] : [];
    const grave = graves.find((g) => sameHex(g.hex, creature.pos));
    if (grave) grave.tables.push(...tables);
    else graves.push({ hex: { ...creature.pos }, tables, examined: false });
  }
  state.collect = { graves, items: [] };
  return [
    {
      type: 'GRAVES_MARKED',
      payload: { battleId: state.id, hexes: graves.map((grave) => ({ ...grave.hex })) },
    },
  ];
}

function rollGrave(state: BattleState, grave: Grave): LootDrop[][] {
  return rollLootLists(
    grave.tables.map((id) => lootTableOf(id)),
    { seed: state.seed, sourceId: state.id, targetKey: hexKey(grave.hex) },
  );
}

function neighboursOf(state: BattleState, target: BattleHex): LootNeighbour[] {
  return lootNeighbours(target, (hex) => isFreeHex(state, hex));
}

function noInventory(): IInventoryDraft {
  return { current: undefined, events: [] };
}

export function lootGrave(
  state: BattleState,
  actor: BattleCreature,
  hex: BattleHex,
  ctx: CollectContext,
): DomainEvent[] | BattleRejection {
  const collect = state.collect!;
  if (graveAt(collect, actor.pos)) return reject('STANDING_ON_TARGET');
  const grave = graveAt(collect, hex);
  if (!grave) return reject('NO_GRAVE');
  if (grave.examined) return reject('GRAVE_EMPTY');
  if (!isAdjacentHex(actor.pos, grave.hex)) return reject('NOT_ADJACENT');
  const bag = ctx.inventory ?? noInventory();
  const spread = planLootSpread({
    target: grave.hex,
    entry: actor.pos,
    neighbours: neighboursOf(state, grave.hex),
    lists: rollGrave(state, grave),
    bag,
  });
  if (!spread.ok) return reject(spread.reason);

  if (spread.plan.placements.length === 0 && spread.plan.toBag.length === 0) {
    grave.examined = true;
    return [
      {
        type: 'GRAVE_LOOTED',
        payload: {
          creatureId: actor.id,
          hex: { ...grave.hex },
          from: { ...actor.pos },
          placed: [],
          toBag: [],
          nothing: true,
        },
      },
    ];
  }

  const from = { ...actor.pos };
  grave.examined = true;
  actor.pos = { ...grave.hex };
  const applied = applySpreadPlan(spread.plan, bag, (place) => {
    collect.items.push({ hex: { ...place.hex }, itemKey: place.itemKey, amount: place.amount });
    return { hex: { ...place.hex }, itemKey: place.itemKey, amount: place.amount };
  });
  return [
    {
      type: 'GRAVE_LOOTED',
      payload: {
        creatureId: actor.id,
        hex: { ...grave.hex },
        from,
        placed: applied.placed,
        toBag: applied.toBag,
      },
    },
  ];
}

export function pickupLoot(
  state: BattleState,
  actor: BattleCreature,
  hex: BattleHex,
  ctx: CollectContext,
): DomainEvent[] | BattleRejection {
  const collect = state.collect!;
  const picked = pickupStack({
    stacks: collect.items,
    isTarget: (item) => sameHex(item.hex, hex),
    adjacent: isAdjacentHex(actor.pos, hex),
    order: 'stack-first',
    bag: ctx.inventory ?? noInventory(),
  });
  if (!picked.ok) return reject(picked.reason);
  const item = picked.stack;
  collect.items = picked.remaining;
  return [
    {
      type: 'LOOT_PICKED',
      payload: {
        creatureId: actor.id,
        hex: { ...item.hex },
        itemKey: item.itemKey,
        amount: item.amount,
      },
    },
  ];
}

export function collectStep(
  state: BattleState,
  mover: BattleCreature,
  hex: BattleHex,
): DomainEvent[] | BattleRejection {
  if (!isAdjacentHex(mover.pos, hex)) return reject('NOT_ADJACENT');
  if (!isFreeHex(state, hex)) return reject('HEX_BLOCKED');
  const from = { ...mover.pos };
  mover.pos = { ...hex };
  return [
    {
      type: 'CREATURE_MOVED',
      payload: { creatureId: mover.id, from, to: { ...hex }, cost: 0, willLeft: 0 },
    },
  ];
}

export function collectRefusal(
  state: BattleState,
  actor: BattleCreature,
  action: BattleAction,
): BattleRejection | null {
  if (!state.collect || !COLLECT_ACTION_KINDS.has(action.kind)) return reject('BATTLE_ENDED');
  if (actor.side !== 'heroes' || !isAlive(actor)) return reject('NOT_YOUR_TURN');
  return null;
}
