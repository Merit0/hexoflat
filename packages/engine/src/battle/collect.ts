import type { DomainEvent } from '../commands/types';
import { lootTableOf } from '../content/loot-tables.content';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import {
  bagTakesAll,
  lootStreamLabel,
  planLootSpread,
  rollLoot,
  type LootDrop,
  type LootNeighbour,
} from '../loot';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { AXIAL_DIRS } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
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
  const rng = deriveStream(state.seed, lootStreamLabel(state.id, hexKey(grave.hex)));
  return grave.tables.flatMap((id) => {
    const table = lootTableOf(id);
    return table ? [rollLoot(table, rng)] : [];
  });
}

function neighboursOf(state: BattleState, target: BattleHex): LootNeighbour[] {
  return AXIAL_DIRS.map((dir) => {
    const hex = { q: target.q + dir.q, r: target.r + dir.r };
    return { hex, free: isFreeHex(state, hex) };
  });
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
  for (const place of spread.plan.placements) {
    collect.items.push({ hex: { ...place.hex }, itemKey: place.itemKey, amount: place.amount });
  }
  for (const drop of spread.plan.toBag) {
    grantToDraft(bag, drop.itemKey, drop.amount, 'loot');
  }
  return [
    {
      type: 'GRAVE_LOOTED',
      payload: {
        creatureId: actor.id,
        hex: { ...grave.hex },
        from,
        placed: spread.plan.placements.map(({ hex: at, itemKey, amount }) => ({
          hex: { ...at },
          itemKey,
          amount,
        })),
        toBag: spread.plan.toBag.map(({ itemKey, amount }) => ({ itemKey, amount })),
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
  const index = collect.items.findIndex((item) => sameHex(item.hex, hex));
  if (index < 0) return reject('NO_LOOT_THERE');
  const item = collect.items[index];
  if (!isAdjacentHex(actor.pos, item.hex)) return reject('NOT_ADJACENT');
  const bag = ctx.inventory ?? noInventory();
  const drop: LootDrop = {
    itemKey: item.itemKey as THexobjectKey,
    amount: item.amount,
    guaranteed: false,
  };
  if (!bagTakesAll(bag, [drop])) return reject('BAG_FULL');
  grantToDraft(bag, drop.itemKey, drop.amount, 'pickup');
  collect.items.splice(index, 1);
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
