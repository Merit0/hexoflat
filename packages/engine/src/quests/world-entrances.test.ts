import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { canEnterQuestWorld, installQuestEntrances } from './world-entrances';
import { executeQuestRunCommand } from './seeker-commands';
import { ALL_QUESTS } from './all-quests';
import { questPlacementMaps } from './world-entrances';

function setup() {
  const world = createServerWorld('silesia', 'silesia-map', 'seed', 'hero');
  const progress = emptyProgressState('hero');
  progress.quests.active.push({ questId: 'seeker-1', progress: 0, state: 'active' });
  return { world, progress };
}

describe('Treasure Seeker world entrance', () => {
  it('uses quest configuration to place and open the same token on another map', () => {
    const { progress } = setup();
    const world = createServerWorld('silesia-north', 'north-map', 'seed', 'hero');
    const catalogue = {
      ...ALL_QUESTS,
      'seeker-1': {
        ...ALL_QUESTS['seeker-1'],
        mapObjectPlacement: {
          targetMap: 'silesia-north' as const,
          objectKey: HEXOBJECT_KEYS.TREASURE_MAP,
          strategy: 'random-empty' as const,
        },
      },
    };
    expect(questPlacementMaps(progress, catalogue)).toEqual(['silesia-north']);
    const unrelated = setup().world;
    installQuestEntrances(unrelated, progress, catalogue);
    expect(unrelated.map.tiles.some((tile) => tile.hexobject?.questId)).toBe(false);
    installQuestEntrances(world, progress, catalogue);
    const marker = world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')!;
    expect(marker).toBeDefined();
    marker.isRevealed = true;
    world.heroCoordinates = getHexNeighbors(marker.coordinates)[0];
    expect(canEnterQuestWorld(world, 'seeker-1', catalogue)).toBe(true);
    progress.quests.active = [];
    installQuestEntrances(world, progress, catalogue);
    expect(world.map.tiles.some((tile) => tile.hexobject?.questId)).toBe(false);
  });

  it('keeps the selected coordinate stable across reconciliation and identical seeded worlds', () => {
    const first = setup();
    const second = setup();
    installQuestEntrances(first.world, first.progress);
    installQuestEntrances(second.world, second.progress);
    const selected = first.world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')!;
    expect(
      second.world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')?.coordinates,
    ).toEqual(selected.coordinates);
    first.world.heroCoordinates = getHexNeighbors(selected.coordinates)[0];
    installQuestEntrances(first.world, first.progress);
    expect(
      first.world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')?.coordinates,
    ).toEqual(selected.coordinates);
  });

  it('does not overwrite objects when no empty ground remains', () => {
    const { world, progress } = setup();
    world.map.tiles = world.map.tiles.filter((tile) => !!tile.hexobject);
    const before = world.map.toJSON();
    installQuestEntrances(world, progress);
    expect(world.map.toJSON()).toEqual(before);
  });

  it('places one map on an empty hex, preserves fog, persists and removes it after abandonment', () => {
    const { world, progress } = setup();
    const occupied = world.map.tiles
      .filter((tile) => tile.hexobject)
      .map((tile) => coordinateKey(tile.coordinates));
    const fog = world.map.tiles.map((tile) => tile.isRevealed);
    installQuestEntrances(world, progress);
    installQuestEntrances(world, progress);
    const markers = world.map.tiles.filter(
      (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.TREASURE_MAP,
    );
    expect(markers).toHaveLength(1);
    expect(occupied).not.toContain(coordinateKey(markers[0].coordinates));
    expect(world.map.tiles.map((tile) => tile.isRevealed)).toEqual(fog);
    const restored = deserializeWorld(serializeWorld(world), 0);
    expect(restored.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')).toBeDefined();
    progress.quests.active = [];
    installQuestEntrances(restored, progress);
    expect(restored.map.tiles.some((tile) => tile.hexobject?.questId)).toBe(false);
  });

  it('shows a newly accepted map immediately on a fully explored world', () => {
    const { world, progress } = setup();
    for (const tile of world.map.tiles) tile.isRevealed = true;
    installQuestEntrances(world, progress);
    const marker = world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1');
    expect(marker?.isRevealed).toBe(true);
  });

  it('allows OPEN only adjacent to the revealed entrance for the accepted quest', () => {
    const { world, progress } = setup();
    installQuestEntrances(world, progress);
    const marker = world.map.tiles.find((tile) => tile.hexobject?.questId === 'seeker-1')!;
    marker.isRevealed = false;
    world.heroCoordinates = getHexNeighbors(marker.coordinates)[0];
    expect(canEnterQuestWorld(world, 'seeker-1')).toBe(false);
    marker.isRevealed = true;
    expect(canEnterQuestWorld(world, 'seeker-1')).toBe(true);
    expect(canEnterQuestWorld(world, 'seeker-2')).toBe(false);
    world.heroCoordinates = marker.coordinates;
    expect(canEnterQuestWorld(world, 'seeker-1')).toBe(false);
  });
});

describe('Treasure Seeker entrance run lifecycle', () => {
  it('pauses at the starting portal and resumes the same run without spending another entry price', () => {
    const { progress } = setup();
    const camp = {
      locationKey: 'camping' as const,
      mapId: 'camp',
      coordinates: { columnIndex: 10, rowIndex: 10 },
    };
    progress.presence = camp;
    const entered = executeQuestRunCommand({
      progress,
      doc: null,
      atEntrance: true,
      newSeed: () => 'quest-seed',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!entered.ok) throw new Error(entered.code);
    const paused = executeQuestRunCommand({
      progress: entered.progress,
      doc: entered.doc,
      atEntrance: false,
      newSeed: () => 'unused',
      command: { type: 'QUEST_PAUSE', payload: { heroId: 'hero' } },
    });
    if (!paused.ok) throw new Error(paused.code);
    expect(paused.doc?.suspended).toBe(true);
    expect(paused.progress.presence).toEqual(camp);
    const resumed = executeQuestRunCommand({
      progress: paused.progress,
      doc: paused.doc,
      atEntrance: true,
      newSeed: () => 'different',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!resumed.ok) throw new Error(resumed.code);
    expect(resumed.doc?.run).toEqual(entered.doc?.run);
    expect(resumed.progress.knowledge.current).toBe(entered.progress.knowledge.current);
    expect(resumed.progress.presence).toBeNull();
  });
});
