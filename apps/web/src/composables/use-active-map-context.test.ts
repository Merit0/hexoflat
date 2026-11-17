import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { createTreasureField, questExitHex } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { battleHexToOffset } from '@hexoflat/engine/battle/battlefield';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { questRun } from '@/services/quests/quest-run-projection';
import { useActiveMapContext } from './use-active-map-context';

const worldPosition = { columnIndex: 2, rowIndex: 3 };

function startQuest(): QuestProjection {
  const { start } = createTreasureField('active-map-context');
  return {
    offerId: 'seeker-1',
    phase: 'walking',
    outcome: null,
    start,
    position: start,
    path: [],
    opened: [],
    hintHex: null,
    chest: null,
    stepCost: 1,
    backCost: 3,
  };
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  questRun.value = null;
  useHeroStore().heroCoordinates = worldPosition;
});
afterEach(() => {
  questRun.value = null;
});

describe('the active map context', () => {
  it('exposes only revealed objects and follows world object replacement', () => {
    const world = useWorldMapStore();
    const map = new HexMapModel();
    const tile = new HexTileModel();
    tile.coordinates = worldPosition;
    tile.hexobject = HexObjectFactory.create(K.TREE, worldPosition);
    map.tiles = [tile];
    world.map = map;
    world.currentMapId = 'world-instance';
    const context = useActiveMapContext();
    expect(context.value).toMatchObject({
      kind: 'world',
      mapId: 'world-instance',
      heroPosition: worldPosition,
    });
    expect(context.value.objectAt(worldPosition)).toBeNull();
    world.map.tiles[0].isRevealed = true;
    expect(context.value.objectAt(worldPosition)?.hexobjectKey).toBe(K.TREE);
    world.map.tiles[0].hexobject = HexObjectFactory.create(K.ROCK, worldPosition);
    expect(context.value.objectAt(worldPosition)?.hexobjectKey).toBe(K.ROCK);
    expect(context.value.objectAt(getHexNeighbors(worldPosition)[0])).toBeNull();
  });

  it('isolates quest floor and portal objects from the saved world and restores world on exit', () => {
    const context = useActiveMapContext();
    const run = startQuest();
    questRun.value = run;
    expect(context.value).toMatchObject({
      kind: 'quest',
      mapId: 'treasure-seeker-map',
      heroPosition: run.position,
    });
    expect(context.value.objectAt(run.position)).toBeNull();
    expect(context.value.objectAt(questExitHex(run.start))?.hexobjectKey).toBe(K.CAMPING_ENTRANCE);
    const next = getHexNeighbors(run.position)[0];
    questRun.value = { ...run, position: next };
    expect(context.value.heroPosition).toEqual(next);
    questRun.value = null;
    expect(context.value.kind).toBe('world');
    expect(context.value.heroPosition).toEqual(worldPosition);
  });

  it('gives battle priority and converts the controlled hero position without world fallback', () => {
    questRun.value = startQuest();
    const battle = useBattleStore();
    battle.deploy = { biome: 'crypt' } as NonNullable<typeof battle.deploy>;
    battle.localHeroIds = ['local'];
    battle.projection = {
      creatures: [
        { id: 'enemy', side: 'enemies', pos: { q: 1, r: 2 } },
        { id: 'other', side: 'heroes', pos: { q: 3, r: 2 } },
        { id: 'local', side: 'heroes', pos: { q: 5, r: 4 } },
      ],
    } as NonNullable<typeof battle.projection>;
    const context = useActiveMapContext();
    expect(context.value.kind).toBe('battle');
    expect(context.value.heroPosition).toEqual(battleHexToOffset('crypt', { q: 5, r: 4 }));
    expect(context.value.heroPosition).not.toEqual(axialToOffset({ q: 5, r: 4 }));
    expect(context.value.objectAt(worldPosition)).toBeNull();
    battle.projection = null;
    expect(context.value.heroPosition).toBeNull();
    battle.deploy = null;
    expect(context.value.kind).toBe('quest');
  });
});
