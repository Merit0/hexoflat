import { describe, expect, it } from 'vitest';
import { battleCreatureDefSchema, BATTLE_CREATURES } from '../battle/battle-catalogue';
import { ContentDefinitionSchema } from '../content/content-schema';
import { CONTENT } from '../content/content-map';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { RecipeSchema } from '../content/boards/recipe-schema';
import { StaticBoardDrawingSchema } from '../content/boards/schemas';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { tokenTypeOfBoard } from '../registry/location-drop-context';
import { MapRegistry } from '../registry/world-map-registry';
import { dimensionSchema, EDimension } from './dimensions';

const NOWHERE = EDimension.NOWHERE;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('DA2 B4: location, drawing and recipe schemas accept nowhere', () => {
  it('CURRENT (B4): the location dimension check of MapRegistry accepts nowhere', () => {
    expect(dimensionSchema.safeParse(NOWHERE).success).toBe(true);
    expect(() => MapRegistry.get('cave')).not.toThrow();
  });

  it('CURRENT (B4): a Nowhere board fails only late, when a token tokenType is read', () => {
    expect(() => tokenTypeOfBoard({ dimension: NOWHERE })).toThrow();
    expect(tokenTypeOfBoard({ dimension: EDimension.UNDERWORLD })).toBe('gloom');
  });

  it('CURRENT (B4): a static board drawing in nowhere parses', () => {
    const drawing = { ...clone(CAMPING_BOARD), dimension: NOWHERE };
    expect(StaticBoardDrawingSchema.safeParse(CAMPING_BOARD).success).toBe(true);
    expect(StaticBoardDrawingSchema.safeParse(drawing).success).toBe(true);
  });

  it('CURRENT (B4): a board recipe in nowhere parses', () => {
    const recipe = { ...clone(CAVE_MODEL), dimension: NOWHERE };
    expect(RecipeSchema.safeParse(CAVE_MODEL).success).toBe(true);
    expect(RecipeSchema.safeParse(recipe).success).toBe(true);
  });
});

describe('DA2 B5: creature schemas accept dimension nowhere', () => {
  it('CURRENT (B5): a map creature (squad) in nowhere parses', () => {
    const squad = CONTENT[HEXOBJECT_KEYS.LONE_SKELETON];
    expect(ContentDefinitionSchema.safeParse(squad).success).toBe(true);
    expect(ContentDefinitionSchema.safeParse({ ...clone(squad), dimension: NOWHERE }).success).toBe(
      true,
    );
  });

  it('CURRENT (B5): a battle creature in nowhere parses', () => {
    const creature = BATTLE_CREATURES['skeleton-warrior'];
    expect(battleCreatureDefSchema.safeParse(creature).success).toBe(true);
    expect(battleCreatureDefSchema.safeParse({ ...creature, dimension: NOWHERE }).success).toBe(
      true,
    );
  });
});
