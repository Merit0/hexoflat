import { describe, expect, it } from 'vitest';
import { emptyProgressState, progressStateSchema } from '../aggregates/progress-state';
import { isTerrainPassable } from '../boards/terrain';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors, hexDistance } from '../utils/hex-utils';
import { createServerWorld } from '../world/server-world';
import { ALL_QUESTS } from './all-quests';
import { seekerBoardOf } from './origin-field';
import { projectQuestForClient } from './projection';
import { planAccept } from './quest-log';
import { executeQuestRunCommand, parseQuestRunDoc } from './seeker-commands';
import { generatedEntrance } from './seeker-entrance-setup';
import { installQuestEntrances, questEntranceFor } from './world-entrances';

function besideMarker(activation = 1) {
  const world = createServerWorld('silesia', 'silesia-map', 'seed', 'hero');
  let progress = emptyProgressState('hero');
  for (let i = 0; i < activation; i += 1) {
    progress.knowledge.current = 50;
    const accepted = planAccept(progress, undefined, 'seeker-1', {
      catalogue: ALL_QUESTS,
      atBoard: true,
    });
    if (!accepted.ok) throw new Error(accepted.reason);
    progress = progressStateSchema.parse(JSON.parse(JSON.stringify(accepted.progress)));
    if (i < activation - 1) progress.quests.active = [];
  }
  installQuestEntrances(world, progress);
  const marker = world.map.tiles.find(
    (tile) => tile.hexobject?.id === world.questEntrances?.['seeker-1'],
  )!;
  marker.isRevealed = true;
  const free = new Set(
    world.map.tiles
      .filter((tile) => !tile.hexobject && isTerrainPassable(tile.terrain))
      .map((tile) => coordinateKey(tile.coordinates)),
  );
  world.heroCoordinates = getHexNeighbors(marker.coordinates).find((hex) =>
    free.has(coordinateKey(hex)),
  )!;
  return { world, progress, marker };
}

function enter(activation = 1) {
  const setup = besideMarker(activation);
  const entered = executeQuestRunCommand({
    progress: setup.progress,
    doc: null,
    entrance: questEntranceFor(setup.world, 'seeker-1'),
    newSeed: () => `quest-${activation}`,
    command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
  });
  if (!entered.ok) throw new Error(entered.code);
  return { ...setup, entered };
}

describe('Treasure Seeker field cloned from the origin map', () => {
  it('copies every tile and its terrain of the origin map and no hexobject', () => {
    const { world, marker } = besideMarker();
    const field = questEntranceFor(world, 'seeker-1')!.field;
    expect(field.origin).toBe('silesia');
    expect(
      field.tiles.map(({ hex, terrain }) => [coordinateKey(hex), terrain ?? 'ground']),
    ).toEqual(world.map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile.terrain]));
    expect(field.exit).toEqual(marker.coordinates);
    expect(JSON.stringify(field)).not.toContain('hexobject');
  });

  it('puts the camping door on the marker hex and the hero where he stood', () => {
    const { world, marker, entered } = enter();
    const run = entered.doc!.run;
    expect(run.start).toEqual(world.heroCoordinates);
    const view = projectQuestForClient(run);
    expect(view.position).toEqual(world.heroCoordinates);
    expect(view.board?.exit).toEqual(marker.coordinates);
    expect(view.board?.border).toEqual([
      { hex: marker.coordinates, objectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
    ]);
    expect(view.chest).toBeNull();
    expect(view.collect).toBeNull();
  });

  it('starts the trail beside the hero and keeps it on walkable ground of the origin map', () => {
    for (let activation = 1; activation <= 12; activation += 1) {
      const { world, entered } = enter(activation);
      const run = entered.doc!.run;
      const board = seekerBoardOf(run);
      const walkable = new Set(
        world.map.tiles
          .filter((tile) => isTerrainPassable(tile.terrain))
          .map((tile) => coordinateKey(tile.coordinates)),
      );
      expect(hexDistance(run.trail[0], run.start)).toBe(1);
      for (const hex of [...run.trail, run.chestHex]) {
        expect(walkable.has(coordinateKey(hex))).toBe(true);
        expect(coordinateKey(hex)).not.toBe(coordinateKey(board.exit));
      }
    }
  });

  it('shows the impassable terrain of the origin map on the quest field', () => {
    const { world, entered } = enter();
    const terrain = projectQuestForClient(entered.doc!.run).board?.terrain ?? [];
    const blocked = world.map.tiles.filter((tile) => !isTerrainPassable(tile.terrain));
    expect(blocked.length).toBeGreaterThan(0);
    expect(terrain.map(({ hex, terrain: kind }) => [coordinateKey(hex), kind])).toEqual(
      blocked.map((tile) => [coordinateKey(tile.coordinates), tile.terrain]),
    );
  });

  it('keeps the cloned field through a save and load of the run document', () => {
    const { entered } = enter();
    const restored = parseQuestRunDoc(JSON.stringify(entered.doc));
    expect(restored.run.field).toEqual(entered.doc!.run.field);
    expect(seekerBoardOf(restored.run)).toEqual(seekerBoardOf(entered.doc!.run));
  });

  it('keeps the generated ring field for runs saved before the clone', () => {
    const entrance = generatedEntrance('legacy');
    const progress = { ...emptyProgressState('hero') };
    progress.quests.active = [{ questId: 'seeker-1', progress: 0, state: 'active' }];
    const entered = executeQuestRunCommand({
      progress,
      doc: null,
      entrance,
      newSeed: () => 'legacy',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!entered.ok) throw new Error(entered.code);
    const legacy = { ...entered.doc!.run };
    delete legacy.field;
    expect(seekerBoardOf(legacy).border.length).toBeGreaterThan(1);
    expect(seekerBoardOf(legacy).exit).toEqual(entrance.field.exit);
  });

  it('refuses the quest without charging anything when no trail fits around the hero', () => {
    const { world, progress } = besideMarker();
    const entrance = questEntranceFor(world, 'seeker-1')!;
    const cramped = {
      ...entrance,
      field: {
        ...entrance.field,
        tiles: entrance.field.tiles.filter(({ hex }) => hexDistance(hex, entrance.start) <= 1),
      },
    };
    const refused = executeQuestRunCommand({
      progress,
      doc: null,
      entrance: cramped,
      newSeed: () => 'cramped',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    expect(refused).toMatchObject({ ok: false, code: 'NO_ROOM_FOR_TRAIL' });
  });
});
