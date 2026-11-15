import { describe, expect, it } from 'vitest';
import { CHEST_REFUSAL_MESSAGES, chestRefusal, type ChestWorld } from '../chests/open-chest';
import { planChestLoot, EMPTY_CHEST_LOOT } from '../chests/plan-chest-loot';
import { worldChestSpace } from '../chests/world-container-space';
import { openInSpace } from '../containers';
import { EHexActionType } from '../enums/hex-action-type';
import {
  blockAround,
  chestScene,
  freeNeighbour,
  HERO,
  itemsAround,
  openAction,
  putObject,
  runOf,
  snapshotOf,
  tileOf,
} from '../chests/chest-test-setup';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, hexDistance, offsetToAxial } from '../utils/hex-utils';
import { actWorld, type ServerWorld } from '../world';

function worldOf(scene: ReturnType<typeof chestScene>, hero = scene.entry): ChestWorld {
  return {
    map: scene.world.map,
    heroes: { [HERO]: { coordinates: { ...hero } } } as unknown as ChestWorld['heroes'],
    loot: { seed: scene.world.worldSeed, sourceId: scene.world.mapId },
  };
}

function farSpot(world: ServerWorld) {
  const hero = world.heroCoordinates!;
  const tile = world.map.tiles.find(
    (t) => t.terrain === 'ground' && !t.hexobject && hexDistance(hero, t.coordinates) >= 3,
  );
  if (!tile) throw new Error('no far tile');
  return { ...tile.coordinates };
}

function standingOn(world: ServerWorld, key: typeof HEXOBJECT_KEYS.CHEST_OPEN) {
  const spot = freeNeighbour(world, world.heroCoordinates!);
  putObject(world, spot, key);
  world.heroCoordinates = { ...spot };
}

describe('CH-P0 world chest: check order (matrix row 1)', () => {
  it('NO_HERO comes first, whatever the target is', () => {
    const scene = chestScene('order-a');
    const world = { ...worldOf(scene), heroes: {} };
    expect(chestRefusal(world, tileOf(scene.world, scene.chest), HERO)).toBe('NO_HERO');
  });

  it('standing on a loot target beats "target is not a full chest" and "not adjacent"', () => {
    const scene = chestScene('order-b');
    standingOn(scene.world, HEXOBJECT_KEYS.CHEST_OPEN);
    const emptyFar = putObject(scene.world, farSpot(scene.world), HEXOBJECT_KEYS.CHEST_OPEN);
    expect(chestRefusal(worldOf(scene, scene.world.heroCoordinates!), emptyFar, HERO)).toBe(
      'STANDING_ON_TARGET',
    );
  });

  it('"not a full chest" (CONTAINER_EMPTY) beats "not adjacent"', () => {
    const scene = chestScene('order-c');
    const far = putObject(scene.world, farSpot(scene.world), HEXOBJECT_KEYS.CHEST_OPEN);
    expect(chestRefusal(worldOf(scene), far, HERO)).toBe('CONTAINER_EMPTY');
  });

  it('a far full chest is NOT_ADJACENT and a near one passes', () => {
    const scene = chestScene('order-d');
    const far = putObject(scene.world, farSpot(scene.world), HEXOBJECT_KEYS.CHEST);
    expect(chestRefusal(worldOf(scene), far, HERO)).toBe('NOT_ADJACENT');
    expect(chestRefusal(worldOf(scene), tileOf(scene.world, scene.chest), HERO)).toBeNull();
  });

  it('every refusal code has a message', () => {
    expect(Object.keys(CHEST_REFUSAL_MESSAGES).sort()).toEqual([
      'BAG_FULL',
      'CONTAINER_EMPTY',
      'NOT_ADJACENT',
      'NO_HERO',
      'NO_ROOM_FOR_LOOT',
      'STANDING_ON_TARGET',
    ]);
  });
});

describe('CH-P0 world chest: re-entry ban and empty state', () => {
  it.each([
    ['an opened chest', HEXOBJECT_KEYS.CHEST_OPEN],
    ['a grave', HEXOBJECT_KEYS.GRAVE],
    ['a full chest', HEXOBJECT_KEYS.CHEST],
  ] as const)('standing on %s refuses OPEN with STANDING_ON_TARGET', (_name, key) => {
    const scene = chestScene('reentry');
    standingOn(scene.world, key as typeof HEXOBJECT_KEYS.CHEST_OPEN);
    const near = freeNeighbour(scene.world, scene.world.heroCoordinates!);
    putObject(scene.world, near, HEXOBJECT_KEYS.CHEST);
    expect(
      chestRefusal(worldOf(scene, scene.world.heroCoordinates!), tileOf(scene.world, near), HERO),
    ).toBe('STANDING_ON_TARGET');
  });

  it('the emptied chest is the chest-open hexobject and a second OPEN on it is CONTAINER_EMPTY', () => {
    const scene = chestScene('empty-state');
    const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
    if (!outcome.ok) throw new Error(outcome.code);
    expect(tileOf(outcome.world, scene.chest).hexobject?.hexobjectKey).toBe(
      HEXOBJECT_KEYS.CHEST_OPEN,
    );
    const next = freeNeighbour(outcome.world, scene.chest);
    outcome.world.heroCoordinates = { ...next };
    const again = actWorld(runOf(outcome.world), openAction(scene.chest));
    expect(JSON.stringify(again.events)).toContain('CONTAINER_EMPTY');
  });
});

describe('CH-P0 world chest: refusal events, price and the order of Will and room', () => {
  it('a refusal answers LOOT_REJECTED then HEX_ACTION_START_REJECTED with the message, and changes nothing', () => {
    const scene = chestScene('refusal-events');
    blockAround(scene.world, scene.chest, scene.entry, 0);
    const run = runOf(scene.world);
    const before = snapshotOf(scene.world);
    const outcome = actWorld(run, openAction(scene.chest));
    expect(outcome.ok).toBe(false);
    const types = outcome.events.map((event) => event.type);
    expect(types.indexOf('LOOT_REJECTED')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('LOOT_REJECTED')).toBeLessThan(types.indexOf('HEX_ACTION_START_REJECTED'));
    expect(outcome.events).toContainEqual({
      type: 'LOOT_REJECTED',
      payload: { heroId: HERO, reason: 'NO_ROOM_FOR_LOOT' },
    });
    const refusedStart = outcome.events.find((event) => event.type === 'HEX_ACTION_START_REJECTED');
    expect((refusedStart?.payload as { message: string }).message).toBe(
      CHEST_REFUSAL_MESSAGES.NO_ROOM_FOR_LOOT,
    );
    expect(types).not.toContain('WILL_SPENT');
    expect(snapshotOf(scene.world)).toBe(before);
    expect(run.progress.knowledge.current).toBe(50);
  });

  it('the room check comes before the Will check: no room and no Will answers NO_ROOM_FOR_LOOT', () => {
    const scene = chestScene('room-before-will');
    blockAround(scene.world, scene.chest, scene.entry, 0);
    const poor = runOf(scene.world);
    poor.progress.knowledge.current = 0;
    const outcome = actWorld(poor, openAction(scene.chest));
    const text = JSON.stringify(outcome.events);
    expect(text).toContain('NO_ROOM_FOR_LOOT');
    expect(text).not.toContain('INSUFFICIENT_WILL');
  });

  it('a successful opening spends exactly the content price (2) with one WILL_SPENT and one CONTAINER_OPENED', () => {
    const scene = chestScene('price');
    const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.progress.knowledge.current).toBe(48);
    expect(outcome.events.filter((event) => event.type === 'WILL_SPENT')).toHaveLength(1);
    expect(outcome.events.filter((event) => event.type === 'CONTAINER_OPENED')).toHaveLength(1);
  });
});

describe('CH-P0 world chest: event payload and hero move', () => {
  it('CONTAINER_OPENED carries exactly actorId, containerId, from, hex, kind, nothing, placed, toBag; placed uses axial hexes', () => {
    const scene = chestScene('payload');
    const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
    if (!outcome.ok) throw new Error(outcome.code);
    const payload = outcome.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
      placed: { hex: unknown; itemKey: string; amount: number }[];
    };
    expect(Object.keys(payload).sort()).toEqual([
      'actorId',
      'containerId',
      'from',
      'hex',
      'kind',
      'nothing',
      'placed',
      'toBag',
    ]);
    expect(Object.keys(payload.placed[0]).sort()).toEqual(['amount', 'hex', 'itemKey']);
    expect(Object.keys(payload.placed[0].hex as object).sort()).toEqual(['q', 'r']);
    expect(outcome.world.heroCoordinates).toEqual(scene.chest);
    expect(itemsAround(outcome.world, scene.chest).length).toBe(payload.placed.length);
  });
});

describe('CH-P0 world chest: empty roll (matrix row "empty-roll behaviour")', () => {
  it('a chest whose roll is empty still opens, the hero stays where he is, placed and toBag are empty (decision 3)', () => {
    const scene = chestScene('empty-roll');
    const world = { ...worldOf(scene), loot: undefined };
    const draft = { current: emptyInventoryState(HERO), events: [] };
    const tile = tileOf(scene.world, scene.chest);
    const opened = openInSpace(
      worldChestSpace(EHexActionType.OPEN),
      world,
      HERO,
      scene.chest,
      draft,
    );
    expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    expect(world.heroes[HERO].coordinates).toEqual(scene.entry);
    expect(opened).toEqual({
      ok: true,
      events: [
        {
          type: 'CONTAINER_OPENED',
          payload: {
            actorId: HERO,
            containerId: coordinateKey(scene.chest),
            kind: 'chest',
            hex: offsetToAxial(scene.chest),
            from: offsetToAxial(scene.entry),
            nothing: true,
            placed: [],
            toBag: [],
          },
        },
      ],
    });
  });

  it('planChestLoot with no loot context rolls nothing, even with no place around', () => {
    const scene = chestScene('empty-roll-b');
    blockAround(scene.world, scene.chest, scene.entry, 0);
    const draft = { current: emptyInventoryState(HERO), events: [] };
    expect(
      planChestLoot(
        scene.world.map,
        tileOf(scene.world, scene.chest),
        scene.entry,
        undefined,
        draft,
      ),
    ).toEqual({ ok: true, plan: EMPTY_CHEST_LOOT });
  });
});
