import { describe, expect, it } from 'vitest';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { staticRecipe } from '../content/boards/recipes/static-recipe';
import { SpawnResourceFeature } from '../features/resource-features/spawn-resource-feature';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { BATTLE_CREATURES, BATTLE_ITEMS, BATTLE_OBJECTS } from '../battle/battle-catalogue';
import { assertBattleDimensions } from '../battle/battle-dimension';
import { generateBattlefield } from '../battle/battlefield';
import { SKILLS, skillDefinitionSchema } from '../skills/skill-content';
import { EDimension } from './dimensions';
import { gateConnects, returnPortalConnects } from './world-connections';

describe('authored world relations', () => {
  it('permits the cave terrain without opening its scope to other Earth objects', () => {
    expect(() => runBoardPipeline(CAVE_MODEL, { seed: 'dimension-cave' })).not.toThrow();
    expect(() =>
      runBoardPipeline({ ...CAVE_MODEL, foreignPlacements: [] }, { seed: 'dimension-cave' }),
    ).toThrow(/recipe:cave: place .* in underworld; object belongs to earth/);
  });

  it('refuses a drawing attached to a recipe of another dimension', () => {
    const recipe = staticRecipe(CAMPING_BOARD, { fog: 'ALL_REVEALED' });
    expect(() =>
      runBoardPipeline({ ...recipe, dimension: EDimension.HEAVEN }, { seed: '' }),
    ).toThrow(/recipe:camping: draw camping in heaven; drawing belongs to earth/);
  });

  it('checks resource respawns before placing an object', () => {
    const map = new HexMapBuilder().name('scope-spawn').width(1).height(1).build();
    const tile = map.tiles[0];
    tile.resourceSpawner = {
      proto: { hexobjectKey: 'tree' },
      regrowMs: 1,
      nextSpawnAt: 1,
      enabled: true,
    };
    expect(() => new SpawnResourceFeature(map).spawn(2, CAVE_MODEL)).toThrow(
      /place tree in underworld/,
    );
    expect(tile.hexobject).toBeNull();
    expect(tile.resourceSpawner.nextSpawnAt).toBe(1);
    tile.resourceSpawner.proto.hexobjectKey = 'rock';
    expect(new SpawnResourceFeature(map).spawn(2, CAVE_MODEL)).toBe(true);
    expect(tile.hexobject?.hexobjectKey).toBe('rock');
  });

  it('scopes concrete combat actors, their equipment and terrain', () => {
    for (const definitions of [BATTLE_CREATURES, BATTLE_ITEMS, BATTLE_OBJECTS])
      for (const definition of Object.values(definitions))
        expect(definition.dimension).toBeDefined();
    const field = generateBattlefield('crypt', 'scoped-crypt');
    expect(() =>
      assertBattleDimensions(field, ['skeleton-warrior', 'skeleton-king', 'skeleton-archer']),
    ).not.toThrow();
    expect(() => assertBattleDimensions(field, ['hero'])).toThrow(
      /deploy hero in underworld; object belongs to earth/,
    );
    expect(() => assertBattleDimensions(field, ['unknown'])).toThrow(/unknown creature unknown/);
  });

  it('assigns the existing skill schools to their dimensions', () => {
    const owners = {
      angelic: EDimension.HEAVEN,
      bionic: EDimension.EARTH,
      demonic: EDimension.UNDERWORLD,
    };
    for (const skill of Object.values(SKILLS)) {
      expect(skillDefinitionSchema.safeParse(skill).success).toBe(true);
      expect(skill.dimension).toBe(owners[skill.branch]);
      for (const id of skill.requires) expect(SKILLS[id]).toBeDefined();
    }
  });

  it('allows only the authored gates and return portal endpoints', () => {
    expect(gateConnects('silesia', 'cave', 'cave-entrance')).toBe(true);
    expect(gateConnects('cave', 'silesia', 'cave-exit')).toBe(true);
    expect(gateConnects('camping', 'cave', 'cave-entrance')).toBe(false);
    expect(gateConnects('cave', 'camping', 'camping-entrance')).toBe(false);
    expect(returnPortalConnects('cave')).toBe(true);
    expect(returnPortalConnects('silesia-north')).toBe(true);
    expect(returnPortalConnects('camping')).toBe(false);
  });
});
