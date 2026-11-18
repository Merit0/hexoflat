import { describe, expect, it } from 'vitest';
import {
  ORIGIN,
  RING_OF_TARGET,
  TARGET,
  fight,
  king,
  lootAt,
  pickAt,
  play,
  stepTo,
  warrior,
  won,
} from '../battle/collect-test-setup';
import { hexagonBoard } from '../battle/battle-test-setup';
import {
  blockAround,
  chestScene,
  freeNeighbour,
  openAction,
  putObject,
  runOf,
} from '../chests/chest-test-setup';
import { inventoryWith } from '../quests/quest-test-setup';
import { seekerCollectStep, seekerOpenChest, seekerPickup } from '../quests/seeker-chest';
import { positionOf } from '../quests/quest-state';
import { followTruth, must, openChestOf, startQuest } from '../quests/seeker-test-setup';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { actWorld } from '../world';

const SEED = 'golden-3';

function worldRefusal(setup: (scene: ReturnType<typeof chestScene>) => void) {
  const scene = chestScene(SEED);
  setup(scene);
  return actWorld(runOf(scene.world), openAction(scene.chest)).events;
}

describe('CH-P0 payload snapshots: the whole open event and every refusal event, world chest', () => {
  it('the full opening: CONTAINER_OPENED and WILL_SPENT', () => {
    const scene = chestScene(SEED);
    const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.events.filter((event) => event.type === 'CONTAINER_OPENED')).toMatchSnapshot();
    expect(outcome.events.filter((event) => event.type === 'WILL_SPENT')).toMatchSnapshot();
  });

  it('STANDING_ON_TARGET', () => {
    expect(
      worldRefusal((scene) => {
        const spot = freeNeighbour(scene.world, scene.chest);
        putObject(scene.world, spot, HEXOBJECT_KEYS.CHEST_OPEN);
        scene.world.heroCoordinates = { ...spot };
      }),
    ).toMatchSnapshot();
  });

  it('CONTAINER_EMPTY', () => {
    expect(
      worldRefusal((scene) => putObject(scene.world, scene.chest, HEXOBJECT_KEYS.CHEST_OPEN)),
    ).toMatchSnapshot();
  });

  it('NOT_ADJACENT (the world answers TOO_FAR before the rule is asked)', () => {
    const scene = chestScene(SEED);
    const far = scene.world.map.tiles.find(
      (tile) =>
        tile.terrain === 'ground' &&
        !tile.hexobject &&
        Math.abs(tile.coordinates.columnIndex - scene.entry.columnIndex) > 3,
    )!;
    putObject(scene.world, far.coordinates, HEXOBJECT_KEYS.CHEST);
    const outcome = actWorld(runOf(scene.world), openAction(far.coordinates));
    expect({ ok: outcome.ok, code: outcome.ok ? null : outcome.code }).toMatchSnapshot();
  });

  it('NO_ROOM_FOR_LOOT', () => {
    expect(
      worldRefusal((scene) => blockAround(scene.world, scene.chest, scene.entry, 0)),
    ).toMatchSnapshot();
  });
});

const GRAVE_SECRET = { seed: SEED, mapId: 'test-map-8' };

describe('CH-P0 payload snapshots: grave', () => {
  const lone = () => won([warrior('e1', TARGET)], { tokenSecret: GRAVE_SECRET });

  it('the full loot: CONTAINER_OPENED', () => {
    expect(play(lone(), lootAt(TARGET)).events).toMatchSnapshot();
  });

  it('the full loot of a boss grave with no room: CONTAINER_OPENED and ITEM_GRANTED', () => {
    const state = won([king('k1', TARGET)], {
      tokenSecret: GRAVE_SECRET,
      board: hexagonBoard(3, RING_OF_TARGET),
    });
    expect(play(state, lootAt(TARGET)).events).toMatchSnapshot();
  });

  it('every refusal: the BATTLE_REJECTED events', () => {
    const looted = play(lone(), lootAt(TARGET)).battle;
    const away = play(looted, stepTo(ORIGIN)).battle;
    const crowded = (enemy: ReturnType<typeof warrior>, bag?: ReturnType<typeof fullBag>) =>
      play(
        won([enemy], { tokenSecret: GRAVE_SECRET, board: hexagonBoard(3, RING_OF_TARGET) }),
        lootAt(TARGET),
        bag,
      ).events;
    expect({
      STANDING_ON_TARGET: play(looted, lootAt(TARGET)).events,
      CONTAINER_EMPTY_NO_GRAVE: play(lone(), lootAt({ q: 0, r: 1 })).events,
      CONTAINER_EMPTY_EXAMINED: play(away, lootAt(TARGET)).events,
      NOT_ADJACENT: play(
        won([warrior('e1', { q: 2, r: 0 })], { tokenSecret: GRAVE_SECRET }),
        lootAt({ q: 2, r: 0 }),
      ).events,
      NO_ROOM_FOR_LOOT: crowded(warrior('e1', TARGET)),
      BAG_FULL: crowded(king('k1', TARGET) as never, fullBag()),
      WRONG_PHASE: play(
        fight([warrior('e1', TARGET), warrior('e2', { q: 3, r: 0 })]),
        lootAt(TARGET),
      ).events,
    }).toMatchSnapshot();
  });

  it('the pickup event and its refusals', () => {
    const state = play(lone(), lootAt(TARGET)).battle;
    const stack = state.collect!.items[0];
    const away = play(state, stepTo(ORIGIN)).battle;
    expect({
      LOOT_PICKED: play(state, pickAt(stack.hex)).events,
      NO_LOOT_THERE: play(state, pickAt({ q: -3, r: 0 })).events,
      NOT_ADJACENT: play(away, pickAt(away.collect!.items.find((i) => i.hex.q === 2)!.hex)).events,
      BAG_FULL: play(state, pickAt(stack.hex), { ...fullBag(), capacityKg: 1000 }).events,
    }).toMatchSnapshot();
  });
});

describe('CH-P0 payload snapshots: quest chest', () => {
  function atChest(seed = SEED) {
    const state = startQuest('seeker-1', seed);
    return { state, end: followTruth(state, 10) };
  }

  it('the full opening: CONTAINER_OPENED', () => {
    const { state, end } = atChest();
    expect(must(openChestOf(state, end)).events).toMatchSnapshot();
  });

  it('every refusal: the QUEST_REJECTED events', () => {
    const { state, end } = atChest();
    const opened = must(openChestOf(state, end));
    const noChest = structuredClone(end.run);
    noChest.chest = null;
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    const ended = structuredClone(end.run);
    ended.phase = 'ended';
    const away = must(
      seekerCollectStep(
        opened.progress,
        opened.run,
        end.run.path[end.run.path.length - 1].hex,
        state.board,
      ),
    );
    const crowdedBoard = { ...state.board, floor: [positionOf(end.run), end.run.chest!.hex] };
    const seeker3 = { inventory: inventoryWith({}), tableId: 'seeker-3-chest-loot' };
    expect({
      STANDING_ON_TARGET: openChestOf(state, opened).events,
      CONTAINER_EMPTY_EXAMINED: openChestOf(state, away).events,
      WRONG_PHASE: openChestOf(state, { progress: end.progress, run: ended }).events,
      CONTAINER_EMPTY_NO_CHEST: openChestOf(state, { progress: end.progress, run: noChest }).events,
      NOT_ADJACENT: openChestOf(state, { progress: end.progress, run: far }).events,
      NO_INVENTORY: seekerOpenChest(end.progress, end.run, state.board, {
        inventory: undefined,
        tableId: 'seeker-1-chest-loot',
      }).events,
      NO_ROOM_FOR_LOOT: seekerOpenChest(
        end.progress,
        { ...end.run, chest: { ...end.run.chest!, drop: undefined, container: undefined } },
        crowdedBoard,
        { inventory: inventoryWith({}), tableId: 'cave-chest-loot' },
      ).events,
      BAG_FULL: seekerOpenChest(end.progress, end.run, crowdedBoard, {
        ...seeker3,
        inventory: fullBag(),
      }).events,
    }).toMatchSnapshot();
  });

  it('the pickup event and its refusals', () => {
    const { state, end } = atChest();
    const opened = must(openChestOf(state, end));
    const ground = opened.run.collect!.ground;
    expect({
      QUEST_LOOT_TAKEN: must(
        seekerPickup(opened.progress, opened.run, ground[0].hex, inventoryWith({})),
      ).events,
      WRONG_PHASE: seekerPickup(end.progress, end.run, ground[0].hex, inventoryWith({})).events,
      NO_INVENTORY: seekerPickup(opened.progress, opened.run, ground[0].hex, undefined).events,
      NO_LOOT_THERE_FAR: seekerPickup(
        opened.progress,
        opened.run,
        state.run.start,
        inventoryWith({}),
      ).events,
      BAG_FULL: seekerPickup(opened.progress, opened.run, ground[0].hex, {
        ...fullBag(),
        capacityKg: 1000,
      }).events,
    }).toMatchSnapshot();
  });
});
