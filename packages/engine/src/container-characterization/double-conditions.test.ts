import { describe, expect, it } from 'vitest';
import { chestRefusal, type ChestWorld } from '../chests/open-chest';
import {
  blockAround,
  chestScene,
  freeNeighbour,
  HERO,
  putObject,
  tileOf,
} from '../chests/chest-test-setup';
import { hexagonBoard } from '../battle/battle-test-setup';
import {
  ORIGIN,
  RING_OF_TARGET,
  TARGET,
  expectRefused,
  lootAt,
  play,
  stepTo,
  warrior,
  won,
} from '../battle/collect-test-setup';
import { positionOf } from '../quests/quest-state';
import { seekerCollectStep } from '../quests/seeker-chest';
import { followTruth, must, openChestOf, startQuest } from '../quests/seeker-test-setup';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { hexDistance } from '../utils/hex-utils';

function worldOf(
  scene: ReturnType<typeof chestScene>,
  hero: { columnIndex: number; rowIndex: number },
): ChestWorld {
  return {
    map: scene.world.map,
    heroes: { [HERO]: { coordinates: { ...hero } } } as unknown as ChestWorld['heroes'],
    loot: { seed: scene.world.worldSeed, sourceId: scene.world.mapId },
  };
}

function farGround(scene: ReturnType<typeof chestScene>) {
  return scene.world.map.tiles.find(
    (t) => t.terrain === 'ground' && !t.hexobject && hexDistance(scene.entry, t.coordinates) >= 3,
  )!.coordinates;
}

describe('CH-P0 double conditions, world chest: today the winner is', () => {
  it('standing on target AND empty -> STANDING_ON_TARGET', () => {
    const scene = chestScene('dc-w1');
    const spot = freeNeighbour(scene.world, scene.chest);
    putObject(scene.world, spot, HEXOBJECT_KEYS.CHEST_OPEN);
    const target = putObject(
      scene.world,
      freeNeighbour(scene.world, spot, 1),
      HEXOBJECT_KEYS.CHEST_OPEN,
    );
    expect(chestRefusal(worldOf(scene, spot), target, HERO)).toBe('STANDING_ON_TARGET');
  });

  it('empty AND not adjacent -> CONTAINER_EMPTY', () => {
    const scene = chestScene('dc-w2');
    const far = putObject(scene.world, farGround(scene), HEXOBJECT_KEYS.CHEST_OPEN);
    expect(chestRefusal(worldOf(scene, scene.entry), far, HERO)).toBe('CONTAINER_EMPTY');
  });

  it('not adjacent AND no room -> NOT_ADJACENT (the room is planned only after the rule)', () => {
    const scene = chestScene('dc-w3');
    const farHex = farGround(scene);
    const far = putObject(scene.world, farHex, HEXOBJECT_KEYS.CHEST);
    blockAround(scene.world, farHex, scene.entry, 0);
    expect(
      chestRefusal(worldOf(scene, scene.entry), tileOf(scene.world, far.coordinates), HERO),
    ).toBe('NOT_ADJACENT');
  });
});

describe('CH-P0 double conditions, grave: today the winner is', () => {
  const stoodOn = () => {
    const looted = play(won([warrior('e1', TARGET)], { seed: 'golden-3' }), lootAt(TARGET));
    return looted.battle;
  };

  it('standing on target AND empty -> STANDING_ON_TARGET', () => {
    expectRefused(stoodOn(), lootAt(TARGET), 'STANDING_ON_TARGET');
  });

  it('empty AND not adjacent -> GRAVE_EMPTY', () => {
    const away = play(play(stoodOn(), stepTo(ORIGIN)).battle, stepTo({ q: -1, r: 0 })).battle;
    expectRefused(away, lootAt(TARGET), 'GRAVE_EMPTY');
  });

  it('not adjacent AND no room -> NOT_ADJACENT', () => {
    const state = won([warrior('e1', { q: 2, r: 0 })], {
      seed: 'dc-g',
      board: hexagonBoard(3, {
        ...RING_OF_TARGET,
        '3,0': 'wall',
        '3,-1': 'wall',
        '2,1': 'wall',
        '1,0': 'wall',
      }),
    });
    expectRefused(state, lootAt({ q: 2, r: 0 }), 'NOT_ADJACENT');
  });
});

describe('CH-P0 double conditions, quest chest: today the winner is', () => {
  function atChest() {
    const state = startQuest('seeker-1', 'dc-q');
    return { state, end: followTruth(state, 10) };
  }

  it('standing on target AND empty -> STANDING_ON_TARGET', () => {
    const { state, end } = atChest();
    const opened = must(openChestOf(state, end));
    expect(openChestOf(state, opened)).toMatchObject({ reason: 'STANDING_ON_TARGET' });
  });

  it('empty AND not adjacent -> CHEST_EMPTY', () => {
    const { state, end } = atChest();
    const opened = must(openChestOf(state, end));
    const away = must(
      seekerCollectStep(
        opened.progress,
        opened.run,
        end.run.path[end.run.path.length - 1].hex,
        state.board,
      ),
    );
    expect(hexDistance(positionOf(away.run), end.run.chest!.hex)).toBe(1);
    expect(openChestOf(state, away)).toMatchObject({ reason: 'CHEST_EMPTY' });
  });

  it('not adjacent AND no room -> NOT_ADJACENT', () => {
    const { state, end } = atChest();
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    const crowded = { ...state.board, floor: [positionOf(end.run), state.run.start] };
    const result = openChestOf({ ...state, board: crowded }, { progress: end.progress, run: far });
    expect(result).toMatchObject({ reason: 'NOT_ADJACENT' });
  });
});
