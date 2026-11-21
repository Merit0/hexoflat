import { describe, expect, it } from 'vitest';
import { fogInventory } from '../map/hero-fog-test-setup';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { chestScene, freeNeighbour, openAction, runOf } from '../chests/chest-test-setup';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  type ServerWorld,
} from './server-world';
import { actWorld, stepWorld } from './world-commands';
import { travelWorld, type TravelRun } from './travel';
import { respawnWorld } from './respawn-world';
import { enterPortalWorld, openPortalWorld } from './portal-world';
import { grantToDraft } from '../inventory/apply-stock';
import type { LocationKey } from '../registry/location-key';

const HERO = 'hero-1';

function hidden(world: ServerWorld): ServerWorld {
  for (const tile of world.map.tiles) tile.isRevealed = false;
  return world;
}

function expectSight(world: ServerWorld, radius: number) {
  const at = world.heroCoordinates!;
  const within = world.map.tiles.filter((tile) => hexDistance(at, tile.coordinates) <= radius);
  expect(within.length).toBeGreaterThan(7);
  expect(within.every((tile) => tile.isRevealed)).toBe(true);
}

function travelRun(world: ServerWorld): TravelRun {
  const camp = hidden(createServerWorld('camping', 'camp', 'seed', HERO));
  return {
    ...runOf(world, { inventory: fogInventory(2) }),
    loadStored: (key) => (key === 'camping' ? camp : null),
    loadById: () => null,
    create: (key: LocationKey) => hidden(createServerWorld(key, `fresh-${key}`, 'seed', HERO)),
  };
}

describe('A01 server fog readers', () => {
  it.each([0, 1, 2])(
    'a step uses equipped sight +%s, returns new fog in tileDiffs and saves it',
    (bonus) => {
      const world = createServerWorld('silesia', 'sight', 'seed', HERO);
      world.map = new HexMapBuilder().name('sight').width(11).height(11).build();
      world.heroCoordinates = { columnIndex: 5, rowIndex: 5 };
      hidden(world);
      const target = { columnIndex: 6, rowIndex: 5 };
      world.map.tiles.find(
        (tile) => coordinateKey(tile.coordinates) === coordinateKey(target),
      )!.isRevealed = true;
      const inventory = bonus ? fogInventory(bonus) : fogInventory(2, false);
      const outcome = stepWorld(runOf(world, { inventory }), target);
      if (!outcome.ok) throw new Error(outcome.code);
      const radius = 1 + bonus;
      for (const tile of outcome.world.map.tiles)
        expect(tile.isRevealed).toBe(hexDistance(target, tile.coordinates) <= radius);
      expect(outcome.tileDiffs).toHaveLength(3 * radius * (radius + 1));
      const restored = deserializeWorld(
        JSON.parse(JSON.stringify(serializeWorld(outcome.world))),
        0,
      );
      expect(restored.map.tiles.map((tile) => tile.isRevealed)).toEqual(
        outcome.world.map.tiles.map((tile) => tile.isRevealed),
      );
    },
  );

  it('a board crossing reveals the arrival with the equipped bonus', () => {
    const world = createServerWorld('silesia', 'origin', 'seed', HERO);
    world.heroCoordinates = { ...world.map.tiles.find((tile) => tile.exit)!.coordinates };
    const outcome = travelWorld(travelRun(world), { kind: 'exit' });
    if (!outcome.ok) throw new Error(outcome.code);
    expectSight(outcome.destination, 3);
  });

  it('respawning reveals the camp around the hero with his equipment', () => {
    const world = createServerWorld('silesia', 'origin', 'seed', HERO);
    const outcome = respawnWorld(travelRun(world));
    if (!outcome.ok) throw new Error(outcome.code);
    expectSight(outcome.destination, 3);
  });

  it('entering a portal reveals the destination with the equipped bonus', () => {
    const world = createServerWorld('silesia', 'origin', 'seed', HERO);
    const run = travelRun(world);
    run.progress.knowledge.skills = { a_crest: 1, a_teleport: 6 };
    const draft = { current: run.inventory, events: [] };
    grantToDraft(draft, 'return-scroll', 1, 'dev');
    run.inventory = draft.current;
    const opened = openPortalWorld(run, freeNeighbour(world, world.heroCoordinates!));
    if (!opened.ok) throw new Error(opened.code);
    const outcome = enterPortalWorld({
      ...run,
      world: opened.world,
      progress: opened.progress,
      inventory: opened.inventory,
    });
    if (!outcome.ok) throw new Error(outcome.code);
    expectSight(outcome.destination, 3);
  });

  it('opening a chest reveals around the new hero position and reports the outer ring', () => {
    const { world, chest } = chestScene();
    hidden(world);
    world.map.tiles.find(
      (tile) => coordinateKey(tile.coordinates) === coordinateKey(chest),
    )!.isRevealed = true;
    const outcome = actWorld(runOf(world, { inventory: fogInventory(2) }), openAction(chest));
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.world.heroCoordinates).toEqual(chest);
    expectSight(outcome.world, 3);
    expect(
      outcome.tileDiffs.some(
        (diff) => hexDistance(chest, diff.tile.coordinates) === 3 && diff.tile.isRevealed,
      ),
    ).toBe(true);
  });
});
