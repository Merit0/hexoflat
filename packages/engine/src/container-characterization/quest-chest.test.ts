import { describe, expect, it } from 'vitest';
import { keysOf } from './golden-setup';
import { NOTHING_FIXTURE_TABLE_ID } from '../content/loot-tables.content';
import { projectQuestForClient } from '../quests/projection';
import { inventoryWith } from '../quests/quest-test-setup';
import { positionOf } from '../quests/quest-state';
import { seekerCollectStep, seekerOpenChest, seekerPickup } from '../quests/seeker-chest';
import { followTruth, must, openChestOf, startQuest } from '../quests/seeker-test-setup';
import { fullBag } from '../trade/trade-test-setup';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

const TABLE = 'seeker-1-chest-loot';

function atChest(seed: string) {
  const state = startQuest('seeker-1', seed);
  return { state, end: followTruth(state, 10) };
}

function opened(seed = 'golden-4') {
  const { state, end } = atChest(seed);
  const result = must(openChestOf(state, end));
  return { state, end, result };
}

describe('CH-P0 quest chest: check order (matrix row 1)', () => {
  it('an already opened chest beats the phase check: on the chest = STANDING_ON_TARGET, away = CONTAINER_EMPTY', () => {
    const { state, end, result } = opened();
    const onChest = { progress: result.progress, run: result.run };
    expect(openChestOf(state, onChest)).toMatchObject({ reason: 'STANDING_ON_TARGET' });
    const phaseWrong = { ...onChest, run: { ...onChest.run, phase: 'ended' as const } };
    expect(openChestOf(state, phaseWrong)).toMatchObject({ reason: 'STANDING_ON_TARGET' });
    const away = must(
      seekerCollectStep(
        result.progress,
        result.run,
        end.run.path[end.run.path.length - 1].hex,
        state.board,
      ),
    );
    expect(openChestOf(state, away)).toMatchObject({ reason: 'CONTAINER_EMPTY' });
  });

  it('the phase check comes before "no chest" (now CONTAINER_EMPTY), and "no chest" before "not adjacent"', () => {
    const { state, end } = atChest('order-a');
    const wrongPhaseNoChest = structuredClone(end.run);
    wrongPhaseNoChest.phase = 'ended';
    wrongPhaseNoChest.chest = null;
    expect(openChestOf(state, { progress: end.progress, run: wrongPhaseNoChest })).toMatchObject({
      reason: 'WRONG_PHASE',
    });
    const noChest = structuredClone(end.run);
    noChest.chest = null;
    expect(openChestOf(state, { progress: end.progress, run: noChest })).toMatchObject({
      reason: 'CONTAINER_EMPTY',
    });
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    expect(openChestOf(state, { progress: end.progress, run: far }, undefined)).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
  });

  it('NO_INVENTORY (a precondition) comes before "not adjacent"; "not adjacent" comes before the room and bag checks', () => {
    const { state, end } = atChest('order-b');
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    expect(
      seekerOpenChest(end.progress, far, state.board, { inventory: undefined, tableId: TABLE }),
    ).toMatchObject({ reason: 'NO_INVENTORY' });
    expect(openChestOf(state, { progress: end.progress, run: far })).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
    expect(
      seekerOpenChest(end.progress, end.run, state.board, { inventory: undefined, tableId: TABLE }),
    ).toMatchObject({ reason: 'NO_INVENTORY' });
  });

  it('the refusal event is QUEST_REJECTED with exactly heroId, questId, reason', () => {
    const { state, end } = atChest('order-c');
    const noChest = structuredClone(end.run);
    noChest.chest = null;
    const refused = openChestOf(state, { progress: end.progress, run: noChest });
    expect(refused.ok).toBe(false);
    expect(refused.events).toEqual([
      {
        type: 'QUEST_REJECTED',
        payload: {
          heroId: end.progress.knowledge.heroId,
          questId: 'seeker-1',
          reason: 'CONTAINER_EMPTY',
        },
      },
    ]);
  });
});

describe('CH-P0 quest chest: price, hero move, room, bag', () => {
  it('opening spends no Will and touches nothing in progress', () => {
    const { end, result } = opened('price');
    expect(result.progress).toEqual(end.progress);
  });

  it('the hero moves onto the chest hex, the entry hex is empty, nothing lies on the chest', () => {
    const { end, result } = opened('move');
    const chest = end.run.chest!.hex;
    expect(positionOf(result.run)).toEqual(chest);
    expect(result.run.collect!.hero).toEqual(chest);
    const keys = result.run.collect!.ground.map((item) => coordinateKey(item.hex));
    expect(keys).not.toContain(coordinateKey(chest));
    expect(keys).not.toContain(coordinateKey(positionOf(end.run)));
    for (const key of keys) {
      expect(getHexNeighbors(chest).map(coordinateKey)).toContain(key);
    }
  });

  it('on a roomy field nothing goes to the bag, so even a full bag opens the chest', () => {
    const { state, end } = atChest('bag');
    expect(openChestOf(state, end, fullBag())).toMatchObject({ ok: true });
  });
});

describe('CH-P0 quest chest: event name and payload', () => {
  it('CHEST_OPENED carries exactly heroId, questId, hex, from, placed, toBag; placed uses offset hexes', () => {
    const { end, result } = opened('payload');
    const event = result.events[0];
    expect(event.type).toBe('CHEST_OPENED');
    expect(keysOf(event.payload)).toEqual(['from', 'heroId', 'hex', 'placed', 'questId', 'toBag']);
    const placed = (event.payload as { placed: object[] }).placed;
    expect(Object.keys(placed[0]).sort()).toEqual(['amount', 'hex', 'itemKey']);
    expect(event.payload).toMatchObject({ hex: end.run.chest!.hex, from: positionOf(end.run) });
  });
});

describe('CH-P0 quest chest: empty roll and empty state', () => {
  it('a real chest cannot be created with an empty drop: the run throws CHEST_DROP_EMPTY', () => {
    const state = startQuest('seeker-1', 'empty-create');
    state.run.chestLootTableId = NOTHING_FIXTURE_TABLE_ID;
    expect(() => followTruth(state, 10)).toThrow('CHEST_DROP_EMPTY');
  });

  it('a legacy chest with no stored drop and an empty table still opens: phase collect, placed and toBag empty', () => {
    const { state, end } = atChest('empty-open');
    const legacy = structuredClone(end.run);
    delete legacy.chest!.drop;
    const result = must(
      seekerOpenChest(end.progress, legacy, state.board, {
        inventory: inventoryWith({}),
        tableId: NOTHING_FIXTURE_TABLE_ID,
      }),
    );
    expect(result.run.phase).toBe('collect');
    expect(result.run.collect!.ground).toEqual([]);
    expect(result.events[0].payload).toMatchObject({ placed: [], toBag: [] });
  });

  it('after OPEN the projection marks the chest empty and the hero stands on it; the stored drop never leaves the run', () => {
    const { end, result } = opened('projection');
    const view = projectQuestForClient(result.run);
    expect(view.chest).toEqual({ hex: end.run.chest!.hex, empty: true });
    expect(JSON.stringify(view)).not.toContain('"drop"');
    expect(JSON.stringify(view)).not.toContain('guaranteed');
  });
});

describe('CH-P0 quest chest: pickup order differs from the grave', () => {
  it('WRONG_PHASE, then NO_INVENTORY, then NO_LOOT_THERE, then NOT_ADJACENT, then BAG_FULL', () => {
    const { state, end, result } = opened('pickup-order');
    const ground = result.run.collect!.ground;
    const near = ground[0].hex;
    const farHex = state.run.start;

    expect(seekerPickup(end.progress, end.run, near, inventoryWith({}))).toMatchObject({
      reason: 'WRONG_PHASE',
    });
    expect(seekerPickup(result.progress, result.run, near, undefined)).toMatchObject({
      reason: 'NO_INVENTORY',
    });
    expect(seekerPickup(result.progress, result.run, farHex, inventoryWith({}))).toMatchObject({
      reason: 'NO_LOOT_THERE',
    });
    const farStack = structuredClone(result.run);
    farStack.collect!.ground.push({ hex: farHex, itemKey: ground[0].itemKey, amount: 1 });
    expect(seekerPickup(result.progress, farStack, farHex, inventoryWith({}))).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
    const empty = getHexNeighbors(result.run.collect!.hero).find(
      (hex) => !ground.some((item) => coordinateKey(item.hex) === coordinateKey(hex)),
    )!;
    expect(seekerPickup(result.progress, result.run, empty, inventoryWith({}))).toMatchObject({
      reason: 'NO_LOOT_THERE',
    });
    expect(seekerPickup(result.progress, result.run, near, fullBag())).toMatchObject({
      reason: 'BAG_FULL',
    });
  });

  it('QUEST_LOOT_TAKEN carries exactly heroId, questId, hex, itemKey, amount and the pickup is free', () => {
    const { result } = opened('pickup-event');
    const item = result.run.collect!.ground[0];
    const taken = must(seekerPickup(result.progress, result.run, item.hex, inventoryWith({})));
    expect(taken.progress).toEqual(result.progress);
    const event = taken.events.find((candidate) => candidate.type === 'QUEST_LOOT_TAKEN')!;
    expect(keysOf(event.payload)).toEqual(['amount', 'heroId', 'hex', 'itemKey', 'questId']);
    expect(
      taken.run.collect!.ground.some((x) => coordinateKey(x.hex) === coordinateKey(item.hex)),
    ).toBe(false);
  });
});
