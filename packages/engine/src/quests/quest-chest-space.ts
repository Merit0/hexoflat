import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import {
  emptiedContainer,
  type ContainerSpace,
  type ContainerState,
  type SpaceApplied,
} from '../containers';
import type { InventoryState } from '../inventory/inventory-state';
import { applySpreadPlan, type LootDrop, type LootNeighbour } from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { axialToOffset, coordinateKey, offsetToAxial, type Axial } from '../utils/hex-utils';
import { positionOf, type QuestRun, type SeekerBoard } from './quest-state';

export type QuestChestPrecondition = 'WRONG_PHASE' | 'NO_INVENTORY';

export interface QuestChestOpening {
  progress: ProgressState;
  source: QuestRun;
  board: SeekerBoard;
  inventory: InventoryState | undefined;
  tableId: string | undefined;
  result: QuestRun | null;
}

export interface QuestChestHelpers {
  neighbours(run: QuestRun, board: SeekerBoard, target: Axial): LootNeighbour[];
  generate(opening: QuestChestOpening): LootDrop[];
  seen(board: SeekerBoard, at: IHexCoordinates): string[];
}

function sameHex(a: IHexCoordinates, b: IHexCoordinates): boolean {
  return coordinateKey(a) === coordinateKey(b);
}

export function questChestSpace(
  helpers: QuestChestHelpers,
): ContainerSpace<QuestChestOpening, IHexCoordinates, QuestChestPrecondition> {
  return {
    preconditions: (state) => {
      if (!state.source.collect && state.source.phase !== 'walking') return 'WRONG_PHASE';
      return state.inventory ? null : 'NO_INVENTORY';
    },
    actorAt: (state) => offsetToAxial(positionOf(state.source)),
    standsOnContainer: (state) =>
      !!state.source.chest && sameHex(positionOf(state.source), state.source.chest.hex),
    containerAt: (state): ContainerState | null => {
      const chest = state.source.chest;
      if (!chest) return null;
      const stored =
        chest.kind === 'real'
          ? chest.drop?.map((entry) => ({ ...entry, itemKey: entry.itemKey as THexobjectKey }))
          : [];
      return {
        id: coordinateKey(chest.hex),
        kind: 'quest-chest',
        at: offsetToAxial(chest.hex),
        contents: chest.container?.contents ?? (stored ? [stored] : null),
        status: chest.container?.status ?? (state.source.collect ? 'empty' : 'full'),
      };
    },
    neighbours: (state, container) => helpers.neighbours(state.source, state.board, container.at),
    rollContents: (state) => [helpers.generate(state)],
    apply: (state, actorId, container, outcome, bag): SpaceApplied => {
      const run = structuredClone(state.source);
      state.result = run;
      const chest = run.chest!;
      const from = offsetToAxial(positionOf(state.source));
      if (chest.kind !== 'real') {
        run.phase = 'ambush';
        return {
          opened: null,
          events: [
            {
              type: 'AMBUSH_SPRUNG',
              payload: { heroId: actorId, questId: run.offerId, deviations: run.lines.length },
            },
          ],
        };
      }
      const { placed, toBag } = applySpreadPlan(outcome.plan, bag, (placement) => ({
        hex: placement.hex,
        itemKey: placement.itemKey,
        amount: placement.amount,
      }));
      run.phase = 'collect';
      chest.container = emptiedContainer(outcome.container);
      run.collect = {
        hero: { ...chest.hex },
        ground: placed.map((item) => ({
          hex: axialToOffset(item.hex),
          itemKey: item.itemKey,
          amount: item.amount,
        })),
        seen: helpers.seen(state.board, chest.hex),
      };
      return { opened: { from, placed, toBag }, events: [] };
    },
    refusalEvents: (state, actorId, _target, reason): DomainEvent[] => [
      {
        type: 'QUEST_REJECTED',
        payload: { heroId: actorId, questId: state.source.offerId, reason },
      },
    ],
  };
}
