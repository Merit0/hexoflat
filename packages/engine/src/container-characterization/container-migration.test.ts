import { worldTokenOrigin } from '../world/server-world';
import { describe, expect, it } from 'vitest';
import { actWorld, deserializeWorld, serializeWorld } from '../world';
import { chestScene, openAction, runOf, tileOf } from '../chests/chest-test-setup';
import { rollChestLoot } from '../chests/plan-chest-loot';
import { createChestContainers } from '../chests/create-chest-containers';
import { king, lootAt, play, TARGET, warrior, won } from '../battle/collect-test-setup';
import { battleStateSchema } from '../battle/battle-state';
import { QuestRunSchema } from '../quests/quest-state';
import { followTruth, must, openChestOf, startQuest } from '../quests/seeker-test-setup';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { GOLDEN_SEEDS } from './golden-setup';

function worldPayload(withContainer: boolean, seed: string) {
  const scene = chestScene(seed);
  if (withContainer)
    createChestContainers(scene.world.map, {
      seed: scene.world.worldSeed,
      sourceId: scene.world.mapId,
      origin: worldTokenOrigin(scene.world),
    });
  const stored = tileOf(scene.world, scene.chest).hexobject!.container;
  const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
  if (!outcome.ok) throw new Error(outcome.code);
  return {
    scene,
    stored,
    payload: outcome.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload,
  };
}

describe('CH-P6 a save made before the container opens with the loot a fresh one gives', () => {
  it.each(GOLDEN_SEEDS)(
    'world chest, seed %s: old save (no container) = fresh container',
    (seed) => {
      const old = worldPayload(false, seed);
      expect(old.stored).toBeUndefined();
      const fresh = worldPayload(true, seed);
      expect(fresh.stored?.status).toBe('full');
      expect(fresh.payload).toEqual(old.payload);
    },
  );

  it.each(GOLDEN_SEEDS)('grave, seed %s: old battle (no container) = fresh container', (seed) => {
    for (const make of [() => warrior('e1', TARGET), () => king('e1', TARGET)]) {
      const fresh = won([make()], { seed });
      expect(fresh.collect!.graves[0].container?.status).toBe('full');
      const oldJson = structuredClone(fresh);
      delete oldJson.collect!.graves[0].container;
      const old = battleStateSchema.parse(JSON.parse(JSON.stringify(oldJson)));
      expect(old.collect!.graves[0].container).toBeUndefined();
      const a = play(fresh, lootAt(TARGET));
      const b = play(old, lootAt(TARGET));
      expect(b.events).toEqual(a.events);
      expect(b.battle.collect!.items).toEqual(a.battle.collect!.items);
    }
  });

  it.each(GOLDEN_SEEDS)('quest chest, seed %s: old run (drop only) = fresh container', (seed) => {
    const state = startQuest('seeker-1', seed);
    const end = followTruth(state, 10);
    expect(end.run.chest!.container?.status).toBe('full');
    const oldRun = QuestRunSchema.parse(JSON.parse(JSON.stringify(end.run)));
    delete oldRun.chest!.container;
    const a = must(openChestOf(state, end));
    const b = must(openChestOf(state, { progress: end.progress, run: oldRun as never }));
    expect(b.events).toEqual(a.events);
  });

  it('a quest run with neither drop nor container still rolls lazily', () => {
    const state = startQuest('seeker-1', 'golden-1');
    const end = followTruth(state, 10);
    const bare = structuredClone(end.run);
    delete bare.chest!.container;
    delete bare.chest!.drop;
    expect(must(openChestOf(state, { progress: end.progress, run: bare })).events).toEqual(
      must(openChestOf(state, end)).events,
    );
  });
});

describe('CH-P6 the generated cave', () => {
  it.each(GOLDEN_SEEDS)(
    'seed %s: the created contents equal what the opening would roll',
    (seed) => {
      const { world } = chestScene(seed);
      const chests = world.map.tiles.filter(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST && tile.hexobject.container,
      );
      expect(chests.length).toBeGreaterThan(0);
      for (const tile of chests) {
        const lazy = [
          rollChestLoot(tile, {
            seed: world.worldSeed,
            sourceId: world.mapId,
            origin: worldTokenOrigin(world),
          }),
        ];
        expect(tile.hexobject!.container!.contents).toEqual(lazy);
      }
    },
  );
});

describe('CH-P6 serialization keeps contents and status', () => {
  it('world: a full chest and the emptied open chest survive a save and load', () => {
    const { scene } = worldPayload(true, 'golden-4');
    const opened = tileOf(scene.world, scene.chest).hexobject!;
    expect(opened.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    expect(opened.container).toMatchObject({ status: 'empty', contents: [] });
    const loaded = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(scene.world))), 1_000);
    expect(tileOf(loaded, scene.chest).hexobject!.container).toEqual(opened.container);

    const fresh = chestScene('golden-5');
    createChestContainers(fresh.world.map, {
      seed: fresh.world.worldSeed,
      sourceId: fresh.world.mapId,
      origin: worldTokenOrigin(fresh.world),
    });
    const full = tileOf(fresh.world, fresh.chest).hexobject!.container!;
    expect(full.status).toBe('full');
    expect(full.contents!.length).toBe(1);
    const back = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(fresh.world))), 1_000);
    expect(tileOf(back, fresh.chest).hexobject!.container).toEqual(full);
  });

  it('grave: contents and status survive a save and load, before and after looting', () => {
    const fresh = won([king('e1', TARGET)], { seed: 'golden-6' });
    const roundTrip = (state: typeof fresh) =>
      battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const before = fresh.collect!.graves[0].container!;
    expect(before.contents!.flat().length).toBeGreaterThan(0);
    expect(roundTrip(fresh).collect!.graves[0].container).toEqual(before);
    const looted = play(fresh, lootAt(TARGET)).battle;
    expect(looted.collect!.graves[0].container).toMatchObject({ status: 'empty', contents: [] });
    expect(roundTrip(looted).collect!.graves[0].container).toEqual(
      looted.collect!.graves[0].container,
    );
  });

  it('quest chest: contents and status survive a save and load, before and after OPEN', () => {
    const state = startQuest('seeker-1', 'golden-7');
    const end = followTruth(state, 10);
    const before = end.run.chest!.container!;
    expect(before.contents![0].length).toBeGreaterThan(0);
    expect(QuestRunSchema.parse(JSON.parse(JSON.stringify(end.run))).chest!.container).toEqual(
      before,
    );
    const opened = must(openChestOf(state, end)).run;
    expect(opened.chest!.container).toMatchObject({ status: 'empty', contents: [] });
    expect(QuestRunSchema.parse(JSON.parse(JSON.stringify(opened))).chest!.container).toEqual(
      opened.chest!.container,
    );
  });
});
