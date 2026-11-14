import type { DomainEvent } from '../commands/types';
import type { ContainerSpace, ContainerState } from '../containers';
import { lootTableOf } from '../content/loot-tables.content';
import { applySpreadPlan, lootNeighbours, rollLootLists } from '../loot';
import { isAlive, isFreeHex } from './battle-board';
import type { BattleCreature, BattleHex, BattleState, CollectState, Grave } from './battle-state';
import { hexKey, sameHex } from './hex-battle-geom';

export type GraveCommandRefusal = 'BATTLE_ENDED' | 'NOT_YOUR_TURN';

export function graveAt(collect: CollectState, hex: BattleHex): Grave | null {
  return collect.graves.find((grave) => sameHex(grave.hex, hex)) ?? null;
}

function graveOf(state: BattleState, hex: BattleHex): Grave | null {
  return state.collect ? graveAt(state.collect, hex) : null;
}

export function collectActorRefusal(
  state: BattleState,
  actor: BattleCreature,
): GraveCommandRefusal | null {
  if (!state.collect) return 'BATTLE_ENDED';
  if (actor.side !== 'heroes' || !isAlive(actor)) return 'NOT_YOUR_TURN';
  return null;
}

function creatureOf(state: BattleState, id: string): BattleCreature {
  return state.creatures.find((creature) => creature.id === id)!;
}

export function graveSpace(): ContainerSpace<BattleState, BattleHex, GraveCommandRefusal> {
  return {
    preconditions: (state, actorId) => collectActorRefusal(state, creatureOf(state, actorId)),
    actorAt: (state, actorId) => creatureOf(state, actorId).pos,
    standsOnContainer: (state, actorId) => !!graveOf(state, creatureOf(state, actorId).pos),
    containerAt: (state, target): ContainerState | null => {
      const grave = graveOf(state, target);
      if (!grave) return null;
      return {
        id: hexKey(grave.hex),
        kind: 'grave',
        at: { ...grave.hex },
        contents: null,
        status: grave.examined ? 'empty' : 'full',
      };
    },
    neighbours: (state, container) => lootNeighbours(container.at, (hex) => isFreeHex(state, hex)),
    rollContents: (state, container) =>
      rollLootLists(
        graveOf(state, container.at)!.tables.map((id) => lootTableOf(id)),
        { seed: state.seed, sourceId: state.id, targetKey: hexKey(container.at) },
      ),
    apply: (state, actorId, container, outcome, bag): DomainEvent[] => {
      const actor = creatureOf(state, actorId);
      const grave = graveOf(state, container.at)!;
      const from = { ...actor.pos };
      grave.examined = true;
      if (outcome.nothing) {
        return [
          {
            type: 'GRAVE_LOOTED',
            payload: {
              creatureId: actor.id,
              hex: { ...grave.hex },
              from,
              placed: [],
              toBag: [],
              nothing: true,
            },
          },
        ];
      }
      actor.pos = { ...grave.hex };
      const items = state.collect!.items;
      const applied = applySpreadPlan(outcome.plan, bag, (place) => {
        items.push({ hex: { ...place.hex }, itemKey: place.itemKey, amount: place.amount });
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
    },
    refusalEvents: () => [],
  };
}
