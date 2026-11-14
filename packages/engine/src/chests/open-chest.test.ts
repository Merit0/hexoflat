import { describe, expect, it } from 'vitest';
import { chestRefusal } from './open-chest';
import { ACTION_STARTERS } from '../registry/action-starters-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import { getReachableTileDistances } from '../hero-movement/reachable-range-service';
import { isEnterableTile } from '../hero-movement/move-planner';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import {
  actWorld,
  applyTileDiffs,
  deserializeWorld,
  serializeWorld,
  stepWorld,
  type WorldOutcome,
} from '../world';
import {
  afterOutcome,
  chestScene,
  freeNeighbour,
  openAction,
  putObject,
  runOf,
  snapshotOf,
  tileOf,
} from './chest-test-setup';

function applied(outcome: WorldOutcome) {
  if (!outcome.ok) throw new Error(outcome.code);
  return outcome;
}

function opened() {
  const scene = chestScene();
  const outcome = applied(actWorld(runOf(scene.world), openAction(scene.chest)));
  return { ...scene, outcome };
}

describe('a step onto a full chest (characterization)', () => {
  it('REQ-LOOT-031: a solid hex is refused, the full chest included', () => {
    const { world, chest } = chestScene();
    const before = snapshotOf(world);
    expect(stepWorld(runOf(world), chest)).toMatchObject({ ok: false, code: 'BLOCKED' });
    expect(snapshotOf(world)).toBe(before);
  });
});

describe('opening a chest', () => {
  it('REQ-LOOT-032: the registry starter for OPEN still answers "broken" for a hand-made object that is not a loot chest', () => {
    const { world, chest } = chestScene();
    const tile = tileOf(world, chest);
    tile.hexobject = null;
    const starter = ACTION_STARTERS[EHexActionType.OPEN];
    const stash = putObject(world, chest, HEXOBJECT_KEYS.STASH_CHEST);
    expect(starter(stash, HEXOBJECT_KEYS.HAND, 1_000, {} as never)).toMatchObject({
      ok: false,
      message: 'The chest is broken and cannot be opened.',
    });
  });

  it('REQ-LOOT-033: success charges the content price once, puts the hero on the chest and empties it, with one opening event', () => {
    const { chest, entry, outcome } = opened();
    expect(outcome.progress.knowledge.current).toBe(48);
    expect(outcome.world.heroCoordinates).toEqual(chest);
    expect(tileOf(outcome.world, chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    const openings = outcome.events.filter((event) => event.type === 'CHEST_OPENED');
    expect(openings).toHaveLength(1);
    expect(openings[0].payload).toMatchObject({
      heroId: 'hero-1',
      coordinates: chest,
      from: entry,
      toBag: [],
    });
    expect((openings[0].payload as { placed: unknown[] }).placed.length).toBeGreaterThan(0);
    expect(outcome.events.filter((event) => event.type === 'WILL_SPENT')).toHaveLength(1);
    expect(
      outcome.tileDiffs.some((diff) => diff.tile.hexobject?.hexobjectKey === 'chest-open'),
    ).toBe(true);
  });

  it('REQ-LOOT-034: the hero moves without paying for a step', () => {
    const { outcome } = opened();
    expect(outcome.progress.knowledge.current).toBe(48);
    expect(outcome.progress.steps).toBe(0);
  });

  it('REQ-LOOT-035: too little Will refuses and changes nothing', () => {
    const { world, chest, entry } = chestScene();
    const poor = runOf(world);
    poor.progress.knowledge.current = 1;
    const before = snapshotOf(world);
    expect(actWorld(poor, openAction(chest))).toMatchObject({ ok: false, code: 'ACTION_REJECTED' });
    expect(snapshotOf(world)).toBe(before);
    expect(world.heroCoordinates).toEqual(entry);
    expect(poor.progress.knowledge.current).toBe(1);
  });

  it('REQ-LOOT-036: standing on a chest refuses OPEN on another chest before any Will is spent', () => {
    const { world, chest } = chestScene();
    const standOn = freeNeighbour(world, chest);
    putObject(world, standOn, HEXOBJECT_KEYS.CHEST);
    world.heroCoordinates = { ...standOn };
    const target = getHexNeighbors(standOn).find(
      (coord) => tileOf(world, coord).hexobject === null && coord.columnIndex !== chest.columnIndex,
    );
    const second = target ?? chest;
    putObject(world, second, HEXOBJECT_KEYS.CHEST);
    const run = runOf(world);
    const before = snapshotOf(world);
    const outcome = actWorld(run, openAction(second));
    expect(outcome).toMatchObject({ ok: false, code: 'ACTION_REJECTED' });
    if (outcome.ok) return;
    expect(outcome.events).toContainEqual({
      type: 'LOOT_REJECTED',
      payload: { heroId: 'hero-1', reason: 'STANDING_ON_TARGET' },
    });
    expect(outcome.events.some((event) => event.type === 'WILL_SPENT')).toBe(false);
    expect(snapshotOf(world)).toBe(before);
    expect(run.progress.knowledge.current).toBe(50);
  });

  it('REQ-LOOT-037: a hero with no Will who stands on a chest is told to step off, not that Will is short', () => {
    const { world, chest } = chestScene();
    const standOn = freeNeighbour(world, chest);
    putObject(world, standOn, HEXOBJECT_KEYS.CHEST);
    world.heroCoordinates = { ...standOn };
    const poor = runOf(world);
    poor.progress.knowledge.current = 0;
    const outcome = actWorld(poor, openAction(chest));
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.events)).toContain('STANDING_ON_TARGET');
  });

  it('REQ-LOOT-038: a chest that is not beside the hero is refused (TOO_FAR from the world, NOT_ADJACENT from the rule)', () => {
    const { world, chest } = chestScene();
    const faraway = { columnIndex: chest.columnIndex + 3, rowIndex: chest.rowIndex };
    const hero = {
      id: 'hero-1',
      controlledBy: null,
      coordinates: faraway,
      heroSteps: 0,
      portal: null,
    };
    expect(
      chestRefusal({ map: world.map, heroes: { 'hero-1': hero } }, tileOf(world, chest), 'hero-1'),
    ).toBe('NOT_ADJACENT');
    world.heroCoordinates = faraway;
    const before = snapshotOf(world);
    expect(actWorld(runOf(world), openAction(chest))).toMatchObject({ ok: false, code: 'TOO_FAR' });
    expect(snapshotOf(world)).toBe(before);
  });

  it('REQ-LOOT-039: a second OPEN on the same chest is refused, from the chest and from beside it', () => {
    const { chest, entry, outcome } = opened();
    const again = actWorld(afterOutcome(outcome), openAction(chest));
    expect(again).toMatchObject({ ok: false });
    expect(JSON.stringify(again.ok ? [] : again.events)).toContain('STANDING_ON_TARGET');

    const off = applied(stepWorld(afterOutcome(outcome), entry));
    const beside = actWorld(afterOutcome(off), openAction(chest));
    expect(beside).toMatchObject({ ok: false });
    expect(JSON.stringify(beside.ok ? [] : beside.events)).toContain('CHEST_EMPTY');
    expect(off.progress.knowledge.current).toBe(47);
  });

  it('REQ-LOOT-040: after leaving, a step back onto the empty chest is refused', () => {
    const { chest, entry, outcome } = opened();
    const off = applied(stepWorld(afterOutcome(outcome), entry));
    expect(stepWorld(afterOutcome(off), chest)).toMatchObject({ ok: false, code: 'BLOCKED' });
  });
});

describe('a hero standing on the chest hex', () => {
  it('REQ-LOOT-041: a step to every free neighbour is a normal step and costs one Will', () => {
    const { chest } = chestScene();
    const probe = opened();
    const exits = getHexNeighbors(chest).filter((coord) => isEnterableTile(probe.world.map, coord));
    expect(exits.length).toBeGreaterThan(0);
    for (const exit of exits) {
      const scene = opened();
      const stepped = applied(stepWorld(afterOutcome(scene.outcome), exit));
      expect(stepped.world.heroCoordinates).toEqual(exit);
      expect(stepped.progress.knowledge.current).toBe(47);
      expect(stepped.progress.steps).toBe(1);
    }
  });

  it('REQ-LOOT-042: with no Will left the ordinary zero-Will rule refuses the step and the hero stays', () => {
    const { entry, outcome } = opened();
    const spent = afterOutcome(outcome);
    spent.progress.knowledge.current = 0;
    expect(stepWorld(spent, entry)).toMatchObject({ ok: false, code: 'INSUFFICIENT_WILL' });
    expect(spent.world.heroCoordinates).toEqual(outcome.world.heroCoordinates);
  });

  it('REQ-LOOT-043: pathfinding and reach start from the chest hex', () => {
    const { world, chest } = opened();
    const reach = getReachableTileDistances(world.map, chest, 2);
    const exits = getHexNeighbors(chest).filter((coord) => isEnterableTile(world.map, coord));
    expect(exits.length).toBeGreaterThan(0);
    for (const exit of exits) expect(reach.get(coordinateKey(exit))).toBe(1);
    expect(reach.has(coordinateKey(chest))).toBe(true);
    const secondKey = [...reach.entries()].find(([, distance]) => distance === 2)?.[0];
    const second = world.map.tiles.find((t) => coordinateKey(t.coordinates) === secondKey);
    expect(second).toBeDefined();
    const path = findShortestPath(world.map, chest, second!.coordinates, 2);
    expect(path).toHaveLength(3);
    expect(path![0]).toEqual(chest);
  });

  it('REQ-LOOT-044: no hex is passable through the chest itself', () => {
    const { world, chest } = opened();
    expect(isEnterableTile(world.map, chest)).toBe(false);
  });

  it('REQ-LOOT-045: the world survives a save and a load with the hero on the chest hex', () => {
    const { chest, outcome } = opened();
    const back = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(outcome.world))), 0);
    expect(back.heroCoordinates).toEqual(chest);
    expect(tileOf(back, chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    expect(snapshotOf(back)).toBe(snapshotOf(outcome.world));
  });

  it('REQ-LOOT-046: a client copy that applies the tile diffs shows the empty chest', () => {
    const scene = chestScene();
    const copy = deserializeWorld(serializeWorld(scene.world), 0);
    const outcome = applied(actWorld(runOf(scene.world), openAction(scene.chest)));
    applyTileDiffs(copy.map, outcome.tileDiffs, 0);
    expect(tileOf(copy, scene.chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
  });

  it('REQ-LOOT-047: opening reveals the hexes around the chest', () => {
    const { world, chest } = opened();
    for (const coord of getHexNeighbors(chest)) {
      const tile = world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === coord.columnIndex &&
          t.coordinates.rowIndex === coord.rowIndex,
      );
      if (tile) expect(tile.isRevealed).toBe(true);
    }
  });
});
