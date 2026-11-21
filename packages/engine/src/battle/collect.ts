import type { DomainEvent } from '../commands/types';
import type { IInventoryDraft } from '../inventory/apply-stock';
import { pickupStack } from '../loot';
import { openInSpace } from '../containers';
import { lootTableIdOfKind } from './battle-catalogue';
import { createGraveContainer } from './grave-contents';
import { collectActorRefusal, graveAt, graveSpace } from './grave-container-space';
import { isAlive, isFreeHex } from './battle-board';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleHex, BattleState, CollectState, Grave } from './battle-state';
import { isAdjacentHex, sameHex } from './hex-battle-geom';
import { reject, type BattleRejection } from './battle-rejection';

export { graveAt };

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
  for (const grave of graves) {
    const bonuses = deathOrder(state, dead)
      .filter((creature) => sameHex(creature.pos, grave.hex) && lootTableIdOfKind(creature.kind))
      .map((creature) => creature.trophyBonus ?? 0);
    if (bonuses.some((bonus) => bonus > 0)) grave.trophyBonuses = bonuses;
    grave.container = createGraveContainer(state, grave);
  }
  state.collect = { graves, items: [] };
  return [
    {
      type: 'GRAVES_MARKED',
      payload: { battleId: state.id, hexes: graves.map((grave) => ({ ...grave.hex })) },
    },
  ];
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
  const opened = openInSpace(graveSpace(), state, actor.id, hex, ctx.inventory ?? noInventory());
  return opened.ok ? opened.events : reject(opened.reason!);
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
  if (!COLLECT_ACTION_KINDS.has(action.kind)) return reject('BATTLE_ENDED');
  const refused = collectActorRefusal(state, actor);
  return refused ? reject(refused) : null;
}
