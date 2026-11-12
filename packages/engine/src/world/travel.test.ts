import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/location-key';
import { getHexNeighbors } from '../utils/hex-utils';
import { createServerWorld, type ServerWorld } from './server-world';
import { travelWorld, type TravelRun, type TravelVia } from './travel';

const HERO = 'hero-1';
const SEED = 'seed';

function runOf(
  world: ServerWorld,
  stored: Partial<Record<LocationKey, ServerWorld>> = {},
  now = 1_000,
): TravelRun {
  return {
    world,
    progress: emptyProgressState(HERO),
    inventory: emptyInventoryState(HERO),
    heroId: HERO,
    now,
    loadStored: (key) => stored[key] ?? null,
    loadById: () => null,
    create: (key) => createServerWorld(key, `fresh-${key}-${now}`, SEED, HERO),
  };
}

function placeBeside(world: ServerWorld, key: THexobjectKey) {
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
  return spot;
}

function standOnExit(world: ServerWorld) {
  const exit = world.map.tiles.find((tile) => tile.exit)!;
  world.heroCoordinates = { ...exit.coordinates };
}

const EXIT: TravelVia = { kind: 'exit' };

describe('a crossing of the board edge on the server', () => {
  it('moves the hero to the neighbouring board, remembers where he rested and sets his presence', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    standOnExit(origin);
    const outcome = travelWorld(runOf(origin), EXIT);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.destination.locationKey).not.toBe('silesia');
    expect(outcome.progress.presence).toMatchObject({
      locationKey: outcome.destination.locationKey,
      mapId: outcome.destination.mapId,
      coordinates: outcome.destination.heroCoordinates,
    });
    expect(outcome.destination.map.tiles.some((t) => t.isRevealed)).toBe(true);
    expect(outcome.replaced).toBeNull();
    expect(outcome.progress.trips).toBe(0);
    expect(outcome.events.map((e) => e.type)).toContain('WORLD_TRAVELLED');
  });

  it('refuses when the hero does not stand on an exit', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    expect(travelWorld(runOf(origin), EXIT)).toMatchObject({ ok: false, code: 'NOT_ON_EXIT' });
  });

  it('refuses a sealed neighbour, and builds a fresh one once the seal has run out', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    standOnExit(origin);
    const probe = travelWorld(runOf(origin), EXIT);
    if (!probe.ok) throw new Error(probe.code);
    const neighbour = probe.destination.locationKey;

    const again = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    standOnExit(again);
    const sealed = runOf(again, {}, 1_000);
    sealed.progress.sealedUntil[neighbour] = 5_000;
    expect(travelWorld(sealed, EXIT)).toMatchObject({ ok: false, code: 'SEALED' });

    const stored = createServerWorld(neighbour, 'old-map', SEED, HERO);
    const lapsed = runOf(again, { [neighbour]: stored }, 9_000);
    lapsed.progress.sealedUntil[neighbour] = 5_000;
    const outcome = travelWorld(lapsed, EXIT);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.destination.mapId).not.toBe('old-map');
    expect(outcome.progress.sealedUntil[neighbour]).toBeUndefined();
  });
});

describe('a gate on the server', () => {
  it('charges the Will printed on the gate, takes the stored map and leaves a static board as it is', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    const spot = placeBeside(origin, HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const stored = createServerWorld('cave', 'cave-1', SEED, HERO);
    const outcome = travelWorld(runOf(origin, { cave: stored }), {
      kind: 'gate',
      coordinates: spot,
    });
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.progress.knowledge.current).toBe(48);
    expect(outcome.destination.mapId).toBe('cave-1');
    expect(outcome.replaced).toBeNull();
  });

  it('counts a trip each time the hero enters the cave, and never when he leaves it', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    const spot = placeBeside(origin, HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const run = runOf(origin, { cave: createServerWorld('cave', 'cave-1', SEED, HERO) });
    run.progress.trips = 3;
    const entered = travelWorld(run, { kind: 'gate', coordinates: spot });
    if (!entered.ok) throw new Error(entered.code);
    expect(entered.progress.trips).toBe(4);
    expect(run.progress.trips).toBe(3);

    const cave = createServerWorld('cave', 'cave-2', SEED, HERO);
    const exit = placeBeside(cave, HEXOBJECT_KEYS.CAMPING_ENTRANCE);
    const back = runOf(cave);
    back.progress.trips = 4;
    const left = travelWorld(back, { kind: 'gate', coordinates: exit });
    if (!left.ok) throw new Error(left.code);
    expect(left.progress.trips).toBe(4);
  });

  it('refuses with too little Will, a hex that is no gate, a gate that is too far and a sealed one', () => {
    const origin = createServerWorld('silesia', 'silesia-1', SEED, HERO);
    const spot = placeBeside(origin, HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const poor = runOf(origin);
    poor.progress.knowledge.current = 1;
    expect(travelWorld(poor, { kind: 'gate', coordinates: spot })).toMatchObject({
      ok: false,
      code: 'ACTION_REJECTED',
    });
    expect(
      travelWorld(runOf(origin), { kind: 'gate', coordinates: { columnIndex: 0, rowIndex: 0 } }),
    ).toMatchObject({ ok: false, code: 'NOT_A_GATE' });
    const sealed = runOf(origin, {}, 1_000);
    sealed.progress.sealedUntil.cave = 9_000;
    expect(travelWorld(sealed, { kind: 'gate', coordinates: spot })).toMatchObject({
      ok: false,
      code: 'SEALED',
    });
  });

  it('replaces a left dungeon with a fresh one, and seals it when the hero cleared it', () => {
    const cave = createServerWorld('cave', 'cave-1', SEED, HERO);
    const spot = placeBeside(cave, HEXOBJECT_KEYS.CAMPING_ENTRANCE);
    const grave = placeBeside(cave, HEXOBJECT_KEYS.GRAVE);
    expect(grave).toBeDefined();
    const outcome = travelWorld(runOf(cave), { kind: 'gate', coordinates: spot });
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.progress.knowledge.current).toBe(50);
    expect(outcome.destination.locationKey).toBe('camping');
    expect(outcome.replaced?.locationKey).toBe('cave');
    expect(outcome.replaced?.mapId).not.toBe('cave-1');
    expect(outcome.progress.sealedUntil.cave).toBeGreaterThan(1_000);
  });
});
