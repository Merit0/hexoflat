import { describe, expect, it } from 'vitest';
import { applyCommand } from './apply-command';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { HexEngineCommand } from './hex-engine-commands';
import {
  buildHero,
  buildMap,
  buildMovementMap,
  createContext,
  nextCommandId,
  TEST_ACTOR_ID,
  toState,
} from './command-test-fixtures';

describe('applyCommand: ADD_RESOURCE_SPAWNER', () => {
  it('adds a spawner to the tile and emits RESOURCE_SPAWNER_ADDED', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    const ctx = createContext();

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'ADD_RESOURCE_SPAWNER',
      payload: {
        heroId: 'hero-1',
        coordinates: tile.coordinates,
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 30_000 } },
      },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      { type: 'RESOURCE_SPAWNER_ADDED', payload: { coordinates: tile.coordinates } },
    ]);
    expect(tile.resourceSpawner).toMatchObject({
      proto: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 30_000 } },
      regrowMs: 30_000,
      nextSpawnAt: null,
      enabled: true,
    });
  });

  it('rejects when there is no tile at the given coordinates', () => {
    const map = buildMap();
    const ctx = createContext();
    const coordinates = { columnIndex: 99, rowIndex: 99 };

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'ADD_RESOURCE_SPAWNER',
      payload: { heroId: 'hero-1', coordinates, hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE } },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'RESOURCE_SPAWNER_REJECTED',
        payload: { coordinates, message: 'No tile at coordinates.' },
      },
    ]);
  });

  it('throws on an invalid command payload', () => {
    const map = buildMap();
    const ctx = createContext();
    const command = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'ADD_RESOURCE_SPAWNER',
      payload: { coordinates: { columnIndex: 0, rowIndex: 0 } },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});

describe('applyCommand: MOVE_HERO', () => {
  it('moves the hero along the shortest path and emits HERO_MOVED', () => {
    const map = buildMovementMap();
    const hero = buildHero();
    const ctx = createContext();
    const target = { columnIndex: 1, rowIndex: 0 };

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: hero.id, target },
    };

    const result = applyCommand(toState(map, { [hero.id]: hero }), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HERO_MOVED',
        payload: {
          heroId: hero.id,
          path: [
            { columnIndex: 0, rowIndex: 0 },
            { columnIndex: 1, rowIndex: 0 },
          ],
          heroSteps: 1,
        },
      },
    ]);
    expect(hero.coordinates).toEqual(target);
    expect(hero.heroSteps).toBe(1);
  });

  it('rejects with HERO_NOT_FOUND for an unknown hero', () => {
    const map = buildMovementMap();
    const ctx = createContext();
    const target = { columnIndex: 1, rowIndex: 0 };

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: 'ghost', target },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HERO_MOVE_REJECTED',
        payload: { heroId: 'ghost', target, reason: 'HERO_NOT_FOUND' },
      },
    ]);
  });

  it('rejects with TILE_OCCUPIED when another hero already stands on the target tile', () => {
    const map = buildMovementMap();
    const hero = buildHero();
    const other = buildHero({ id: 'hero-2', coordinates: { columnIndex: 1, rowIndex: 0 } });
    const ctx = createContext();
    const target = { columnIndex: 1, rowIndex: 0 };

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: hero.id, target },
    };

    const result = applyCommand(toState(map, { [hero.id]: hero, [other.id]: other }), command, ctx);

    expect(result.events).toEqual([
      { type: 'HERO_MOVE_REJECTED', payload: { heroId: hero.id, target, reason: 'TILE_OCCUPIED' } },
    ]);
    expect(hero.coordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
  });

  it('rejects with UNREACHABLE when the target is beyond the hero move range', () => {
    const map = buildMovementMap();
    const hero = buildHero();
    const ctx = createContext();
    const target = { columnIndex: 2, rowIndex: 2 };

    const command: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: hero.id, target },
    };

    const result = applyCommand(toState(map, { [hero.id]: hero }), command, ctx);

    expect(result.events).toEqual([
      { type: 'HERO_MOVE_REJECTED', payload: { heroId: hero.id, target, reason: 'UNREACHABLE' } },
    ]);
    expect(hero.coordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
  });

  it('throws on an invalid command payload', () => {
    const map = buildMovementMap();
    const ctx = createContext();
    const command = {
      commandId: nextCommandId(),
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: 'hero-1' },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});
