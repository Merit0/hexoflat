import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { questEntranceFor, installQuestEntrances } from './world-entrances';
import { executeQuestRunCommand } from './seeker-commands';
import { ALL_QUESTS } from './all-quests';
import { questPlacementMaps } from './world-entrances';
import { planAccept, planAbandon } from './quest-log';
import { progressStateSchema } from '../aggregates/progress-state';

function setup() {
  const world = createServerWorld('silesia', 'silesia-map', 'seed', 'hero');
  const progress = emptyProgressState('hero');
  progress.quests.active.push({ questId: 'seeker-1', progress: 0, state: 'active' });
  return { world, progress };
}

describe('fresh placement on each activation', () => {
  it.each(['seeker-1', 'seeker-2', 'seeker-3'])(
    '%s draws new empty hexes and preserves each placement after reload',
    (questId) => {
      let { world } = setup();
      let progress = emptyProgressState('hero');
      progress.quests.done = { 'seeker-1': 1, 'seeker-2': 1 };
      const selected = new Set<string>();
      for (let activation = 1; activation <= 12; activation++) {
        progress.knowledge.current = 50;
        const accepted = planAccept(progress, undefined, questId, {
          catalogue: ALL_QUESTS,
          atBoard: true,
        });
        if (!accepted.ok) throw new Error(accepted.reason);
        progress = progressStateSchema.parse(JSON.parse(JSON.stringify(accepted.progress)));
        expect(progress.quests.placementActivations?.[questId]).toBe(activation);
        const occupied = new Set(
          world.map.tiles
            .filter((tile) => tile.hexobject)
            .map((tile) => coordinateKey(tile.coordinates)),
        );
        const heroBefore = structuredClone(world.heroCoordinates);
        installQuestEntrances(world, progress);
        const marker = world.map.tiles.find(
          (tile) => tile.hexobject?.id === world.questEntrances?.[questId],
        )!;
        expect(occupied.has(coordinateKey(marker.coordinates))).toBe(false);
        expect(world.heroCoordinates).toEqual(heroBefore);
        selected.add(coordinateKey(marker.coordinates));
        world = deserializeWorld(serializeWorld(world), 0);
        installQuestEntrances(world, progress);
        expect(
          world.map.tiles.find((tile) => tile.hexobject?.id === world.questEntrances?.[questId])
            ?.coordinates,
        ).toEqual(marker.coordinates);
        const abandoned = planAbandon(progress, undefined, questId);
        if (!abandoned.ok) throw new Error(abandoned.reason);
        progress = abandoned.progress;
        installQuestEntrances(world, progress);
      }
      expect(selected.size).toBeGreaterThan(1);
    },
  );
});

describe('Treasure Seeker world entrance', () => {
  it('uses quest configuration to place and open the same token on another map', () => {
    const { progress } = setup();
    const world = createServerWorld('silesia-north', 'north-map', 'seed', 'hero');
    const catalogue = {
      ...ALL_QUESTS,
      'seeker-1': {
        ...ALL_QUESTS['seeker-1'],
        locations: ['silesia-north' as const],
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
    expect(Object.keys(unrelated.questEntrances ?? {}).length > 0).toBe(false);
    installQuestEntrances(world, progress, catalogue);
    const marker = world.map.tiles.find(
      (tile) => tile.hexobject?.id === world.questEntrances?.['seeker-1'],
    )!;
    expect(marker).toBeDefined();
    marker.isRevealed = true;
    world.heroCoordinates = getHexNeighbors(marker.coordinates)[0];
    expect(questEntranceFor(world, 'seeker-1', catalogue)).not.toBeNull();
    progress.quests.active = [];
    installQuestEntrances(world, progress, catalogue);
    expect(Object.keys(world.questEntrances ?? {}).length > 0).toBe(false);
  });

  it('keeps the selected coordinate stable across reconciliation and identical seeded worlds', () => {
    const first = setup();
    const second = setup();
    installQuestEntrances(first.world, first.progress);
    installQuestEntrances(second.world, second.progress);
    const selected = first.world.map.tiles.find(
      (tile) => tile.hexobject?.id === first.world.questEntrances?.['seeker-1'],
    )!;
    expect(
      second.world.map.tiles.find(
        (tile) => tile.hexobject?.id === second.world.questEntrances?.['seeker-1'],
      )?.coordinates,
    ).toEqual(selected.coordinates);
    first.world.heroCoordinates = getHexNeighbors(selected.coordinates)[0];
    installQuestEntrances(first.world, first.progress);
    expect(
      first.world.map.tiles.find(
        (tile) => tile.hexobject?.id === first.world.questEntrances?.['seeker-1'],
      )?.coordinates,
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
    expect(
      restored.map.tiles.find(
        (tile) => tile.hexobject?.id === restored.questEntrances?.['seeker-1'],
      ),
    ).toBeDefined();
    progress.quests.active = [];
    installQuestEntrances(restored, progress);
    expect(Object.keys(restored.questEntrances ?? {}).length > 0).toBe(false);
  });
});

describe('quest entrance saved ownership', () => {
  it('upcasts legacy quest ownership without retaining it on generic objects', () => {
    const { world, progress } = setup();
    installQuestEntrances(world, progress);
    const saved = serializeWorld(world);
    const objectId = world.questEntrances!['seeker-1'];
    const marker = saved.map.tiles.find((tile) => tile.hexobject?.id === objectId)!;
    Object.assign(marker.hexobject!, { questId: 'seeker-1' });
    delete saved.questEntrances;
    const restored = deserializeWorld(saved, 0);
    expect(restored.questEntrances).toEqual({ 'seeker-1': objectId });
    expect(restored.map.tiles.some((tile) => tile.hexobject && 'questId' in tile.hexobject)).toBe(
      false,
    );
    installQuestEntrances(restored, progress);
    expect(
      restored.map.tiles.filter(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.TREASURE_MAP,
      ),
    ).toHaveLength(1);
    expect(serializeWorld(restored).questEntrances).toEqual({ 'seeker-1': objectId });
  });

  it('preserves stable generic object identities across world hydration', () => {
    const { world, progress } = setup();
    installQuestEntrances(world, progress);
    const objectId = world.questEntrances!['seeker-1'];
    const marker = world.map.tiles.find((tile) => tile.hexobject?.id === objectId)!;
    marker.hexobject!.id = 'stable-placement-id';
    world.questEntrances!['seeker-1'] = 'stable-placement-id';
    const restored = deserializeWorld(serializeWorld(world), 0);
    installQuestEntrances(restored, progress);
    expect(restored.questEntrances!['seeker-1']).toBe('stable-placement-id');
    expect(
      restored.map.tiles.filter(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.TREASURE_MAP,
      ),
    ).toHaveLength(1);
  });
});

describe('quest entrance access', () => {
  it('reports a change only when a marker is placed or removed', () => {
    const { world, progress } = setup();
    expect(installQuestEntrances(world, progress)).toBe(true);
    expect(installQuestEntrances(world, progress)).toBe(false);
    progress.quests.active = [];
    expect(installQuestEntrances(world, progress)).toBe(true);
    expect(installQuestEntrances(world, progress)).toBe(false);
  });

  it('shows a newly accepted map immediately on a fully explored world', () => {
    const { world, progress } = setup();
    for (const tile of world.map.tiles) tile.isRevealed = true;
    installQuestEntrances(world, progress);
    const marker = world.map.tiles.find(
      (tile) => tile.hexobject?.id === world.questEntrances?.['seeker-1'],
    );
    expect(marker?.isRevealed).toBe(true);
  });

  it('allows OPEN only adjacent to the revealed entrance for the accepted quest', () => {
    const { world, progress } = setup();
    installQuestEntrances(world, progress);
    const marker = world.map.tiles.find(
      (tile) => tile.hexobject?.id === world.questEntrances?.['seeker-1'],
    )!;
    marker.isRevealed = false;
    world.heroCoordinates = getHexNeighbors(marker.coordinates)[0];
    expect(questEntranceFor(world, 'seeker-1')).toBeNull();
    marker.isRevealed = true;
    expect(questEntranceFor(world, 'seeker-1')).not.toBeNull();
    expect(questEntranceFor(world, 'seeker-2')).toBeNull();
    world.heroCoordinates = marker.coordinates;
    expect(questEntranceFor(world, 'seeker-1')).toBeNull();
  });
});

function standingBesideEntrance() {
  const { world, progress } = setup();
  installQuestEntrances(world, progress);
  const marker = world.map.tiles.find(
    (tile) => tile.hexobject?.id === world.questEntrances?.['seeker-1'],
  )!;
  marker.isRevealed = true;
  const free = new Set(
    world.map.tiles
      .filter((tile) => !tile.hexobject && tile.terrain === 'ground')
      .map((tile) => coordinateKey(tile.coordinates)),
  );
  world.heroCoordinates = getHexNeighbors(marker.coordinates).find((hex) =>
    free.has(coordinateKey(hex)),
  )!;
  return { world, progress, marker };
}

describe('Treasure Seeker entrance run lifecycle', () => {
  it('pauses at the starting portal and resumes the same run without spending another entry price', () => {
    const { world, progress } = standingBesideEntrance();
    const camp = {
      locationKey: 'camping' as const,
      mapId: 'camp',
      coordinates: { columnIndex: 10, rowIndex: 10 },
    };
    progress.presence = {
      locationKey: 'silesia',
      mapId: world.mapId,
      coordinates: world.heroCoordinates!,
    };
    const entered = executeQuestRunCommand({
      progress,
      doc: null,
      entrance: questEntranceFor(world, 'seeker-1'),
      camp,
      newSeed: () => 'quest-seed',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!entered.ok) throw new Error(entered.code);
    expect(entered.doc?.camp).toEqual(camp);
    const paused = executeQuestRunCommand({
      progress: entered.progress,
      doc: entered.doc,
      entrance: null,
      newSeed: () => 'unused',
      command: { type: 'QUEST_PAUSE', payload: { heroId: 'hero' } },
    });
    if (!paused.ok) throw new Error(paused.code);
    expect(paused.doc?.suspended).toBe(true);
    expect(paused.progress.presence).toEqual(camp);
    const resumed = executeQuestRunCommand({
      progress: paused.progress,
      doc: paused.doc,
      entrance: questEntranceFor(world, 'seeker-1'),
      newSeed: () => 'different',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!resumed.ok) throw new Error(resumed.code);
    expect(resumed.doc?.run).toEqual(entered.doc?.run);
    expect(resumed.progress.knowledge.current).toBe(entered.progress.knowledge.current);
    expect(resumed.progress.presence).toBeNull();
  });

  it('refuses another quest while a live run waits behind the door', () => {
    const { world, progress } = standingBesideEntrance();
    progress.quests.active.push({ questId: 'seeker-2', progress: 0, state: 'active' });
    const entered = executeQuestRunCommand({
      progress,
      doc: null,
      entrance: questEntranceFor(world, 'seeker-1'),
      newSeed: () => 'quest-seed',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!entered.ok) throw new Error(entered.code);
    const paused = executeQuestRunCommand({
      progress: entered.progress,
      doc: entered.doc,
      entrance: null,
      newSeed: () => 'unused',
      command: { type: 'QUEST_PAUSE', payload: { heroId: 'hero' } },
    });
    if (!paused.ok) throw new Error(paused.code);
    const other = executeQuestRunCommand({
      progress: paused.progress,
      doc: paused.doc,
      entrance: questEntranceFor(world, 'seeker-1'),
      newSeed: () => 'other',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-2' } },
    });
    expect(other).toMatchObject({ ok: false, code: 'OTHER_QUEST_SUSPENDED' });
  });

  it('starts a new quest over a paused run that can no longer be resumed', () => {
    const { world, progress } = standingBesideEntrance();
    progress.quests.active.push({ questId: 'seeker-2', progress: 0, state: 'active' });
    const entered = executeQuestRunCommand({
      progress,
      doc: null,
      entrance: questEntranceFor(world, 'seeker-1'),
      newSeed: () => 'quest-seed',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-1' } },
    });
    if (!entered.ok) throw new Error(entered.code);
    const doc = {
      ...entered.doc!,
      suspended: true,
      run: { ...entered.doc!.run, resolution: 'lost' as const },
    };
    const other = executeQuestRunCommand({
      progress: entered.progress,
      doc,
      entrance: questEntranceFor(world, 'seeker-1'),
      newSeed: () => 'other',
      command: { type: 'QUEST_ENTER', payload: { heroId: 'hero', questId: 'seeker-2' } },
    });
    if (!other.ok) throw new Error(other.code);
    expect(other.doc?.run.offerId).toBe('seeker-2');
    expect(other.doc?.suspended).toBeUndefined();
  });
});
