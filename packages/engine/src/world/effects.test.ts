import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { getHexNeighbors } from '../utils/hex-utils';
import {
  actWorld,
  createServerWorld,
  tickWorld,
  type ServerWorld,
  type WorldClientHint,
  type WorldEffect,
  type WorldRun,
} from './index';

const HERO = 'hero-1';

function setup(key: THexobjectKey) {
  const world = createServerWorld('camping', 'map-fx', 'seed', HERO);
  const spot = getHexNeighbors(world.heroCoordinates!).find((hex) => {
    const tile = world.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
    );
    return !!tile && !tile.hexobject && tile.terrain === 'ground';
  })!;
  const tile = world.map.tiles.find(
    (t) =>
      t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
  )!;
  tile.hexobject = HexObjectFactory.create(key, spot);
  tile.isRevealed = true;
  return { world, spot };
}

function run(
  world: ServerWorld,
  now: number,
  client?: WorldClientHint,
  health?: { current: number; bonus: number; debt: number },
): WorldRun {
  const progress = emptyProgressState(HERO);
  if (health) progress.health = health;
  return {
    world,
    progress,
    inventory: emptyInventoryState(HERO),
    heroId: HERO,
    now,
    client,
  };
}

function act(
  world: ServerWorld,
  spot: { columnIndex: number; rowIndex: number },
  actionType: EHexActionType,
  toolKey: string,
  client?: WorldClientHint,
  health?: { current: number; bonus: number; debt: number },
) {
  return actWorld(run(world, 1_000, client, health), {
    heroId: HERO,
    coordinates: spot,
    actionType,
    toolKey,
    now: 1_000,
  });
}

function kinds(effects: WorldEffect[]) {
  return effects.map((effect) => effect.kind);
}

describe('what an action asks the client to replay', () => {
  it('cutting a tree locks the tool, spends durability, then gathers, logs and counts the wood', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.TREE);
    const started = act(world, spot, EHexActionType.CUT, HEXOBJECT_KEYS.AXE);
    if (!started.ok) throw new Error(started.code);
    expect(kinds(started.effects)).toEqual(['consumeDurability', 'lockTool']);
    expect(started.effects[1]).toMatchObject({ kind: 'lockTool', coordinates: spot });

    const done = tickWorld({ ...run(started.world, 60_000), progress: started.progress });
    if (!done.ok) throw new Error(done.code);
    expect(kinds(done.effects)).toEqual(['gather', 'log', 'treeCut', 'unlockTool']);
    expect(done.effects[0]).toMatchObject({ key: HEXOBJECT_KEYS.TREE, amount: 1 });
    expect(done.effects[1]).toMatchObject({ text: 'Cut the Tree', type: 'ACTION' });
  });

  it('mining a rock gathers the stone and counts it', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.ROCK);
    const started = act(world, spot, EHexActionType.MINE, HEXOBJECT_KEYS.PICKAXE);
    if (!started.ok) throw new Error(started.code);
    expect(kinds(started.effects)).toEqual(['consumeDurability', 'lockTool']);
    const done = tickWorld({ ...run(started.world, 60_000), progress: started.progress });
    if (!done.ok) throw new Error(done.code);
    expect(kinds(done.effects)).toEqual(['log', 'gather', 'stones', 'unlockTool']);
  });

  it('taking an item spends durability and locks the tool, then only unlocks it when done', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.HEALTH_BOTTLE);
    const started = act(world, spot, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND);
    if (!started.ok) throw new Error(started.code);
    expect(kinds(started.effects)).toEqual(['consumeDurability', 'lockTool']);
    const done = tickWorld({
      ...run(started.world, 60_000),
      progress: started.progress,
      inventory: started.inventory,
    });
    if (!done.ok) throw new Error(done.code);
    expect(kinds(done.effects)).toEqual(['unlockTool']);
  });

  it('resting at a fire heals while the client says the hand still rests there, and stops when it does not', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.FIREPLACE);
    const hurt = { current: 1, bonus: 0, debt: 0 };
    const resting: WorldClientHint = {
      tool: { dragging: true, hover: spot, active: HEXOBJECT_KEYS.HAND },
    };
    const started = act(world, spot, EHexActionType.USE, HEXOBJECT_KEYS.HAND, resting, hurt);
    if (!started.ok) throw new Error(started.code);
    expect(kinds(started.effects)).toEqual(['lockTool']);

    const tick = tickWorld({
      ...run(started.world, 20_000, resting),
      progress: started.progress,
    });
    if (!tick.ok) throw new Error(tick.code);
    expect(kinds(tick.effects)).toEqual(['heal', 'log', 'unlockTool', 'lockTool']);
    expect(tick.effects[0]).toMatchObject({ amount: 1 });
    expect(tick.progress.health.current).toBe(2);
    const next = tick.effects[3];
    expect(next).toMatchObject({ kind: 'lockTool', coordinates: spot });

    const left: WorldClientHint = {
      tool: { dragging: false, hover: null, active: HEXOBJECT_KEYS.HAND },
    };
    const stopped = tickWorld({
      ...run(tick.world, 40_000, left),
      progress: tick.progress,
    });
    if (!stopped.ok) throw new Error(stopped.code);
    expect(kinds(stopped.effects)).toEqual(['heal', 'log', 'unlockTool']);
    expect(stopped.progress.health.current).toBe(3);
  });

  it('stops healing a hero who is already full', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.FIREPLACE);
    const full: WorldClientHint = {
      tool: { dragging: true, hover: spot, active: HEXOBJECT_KEYS.HAND },
    };
    expect(act(world, spot, EHexActionType.USE, HEXOBJECT_KEYS.HAND, full)).toMatchObject({
      ok: false,
    });
  });

  it('records no effects for a refused action', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.TREE);
    const refused = act(world, spot, EHexActionType.CUT, HEXOBJECT_KEYS.HAND);
    expect(refused).toMatchObject({ ok: false, effects: [] });
  });

  it('refuses a tool that breaks on this use, and still reports the wear and the fall back to the hand', () => {
    const { world, spot } = setup(HEXOBJECT_KEYS.TREE);
    const worn: WorldClientHint = {
      tool: {
        dragging: true,
        hover: spot,
        active: HEXOBJECT_KEYS.AXE,
        durability: { current: 1, max: 100 },
      },
    };
    const refused = act(world, spot, EHexActionType.CUT, HEXOBJECT_KEYS.AXE, worn);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe('ACTION_REJECTED');
    expect(kinds(refused.effects)).toEqual(['consumeDurability', 'setActiveTool']);
    expect(refused.effects[1]).toMatchObject({ key: HEXOBJECT_KEYS.HAND });
  });
});

describe('what an action costs, from content and the location only', () => {
  function atCave(key: THexobjectKey) {
    const world = createServerWorld('silesia', 'map-cost', 'seed', HERO);
    const spot = getHexNeighbors(world.heroCoordinates!).find((hex) => {
      const tile = world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const tile = world.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
    )!;
    tile.hexobject = HexObjectFactory.create(key, spot);
    tile.isRevealed = true;
    return { world, spot };
  }

  it('charges the 2 Will printed on the cave entrance, together with the action', () => {
    const { world, spot } = atCave(HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const outcome = act(world, spot, EHexActionType.ENTER, HEXOBJECT_KEYS.HAND);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.progress.knowledge.current).toBe(48);
  });

  it('refuses with too little Will and changes nothing', () => {
    const { world, spot } = atCave(HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const poor = run(world, 1_000);
    poor.progress.knowledge.current = 1;
    const outcome = actWorld(poor, {
      heroId: HERO,
      coordinates: spot,
      actionType: EHexActionType.ENTER,
      toolKey: HEXOBJECT_KEYS.HAND,
      now: 1_000,
    });
    expect(outcome).toMatchObject({ ok: false, code: 'ACTION_REJECTED', effects: [] });
    expect(poor.progress.knowledge.current).toBe(1);
  });
});
