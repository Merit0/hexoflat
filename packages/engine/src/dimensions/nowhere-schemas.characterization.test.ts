import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { battleCreatureDefSchema, BATTLE_CREATURES } from '../battle/battle-catalogue';
import { ContentDefinitionSchema } from '../content/content-schema';
import { CONTENT } from '../content/content-map';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { RecipeSchema } from '../content/boards/recipe-schema';
import { StaticBoardDrawingSchema } from '../content/boards/schemas';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { LOCATION_DIMENSIONS, locationDimensionsSchema } from '../registry/location-key';
import { MapRegistry } from '../registry/world-map-registry';
import {
  DIMENSIONS,
  dimensionConfigRecordSchema,
  EDimension,
  locationDimensionSchema,
} from './dimensions';

const NOWHERE = EDimension.NOWHERE;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const NAMED_ERROR = 'NOT_A_LOCATION_DIMENSION: nowhere';

function expectNowhereRefused(schema: z.ZodType, valid: unknown, refused: unknown): void {
  expect(schema.safeParse(valid).success).toBe(true);
  const result = schema.safeParse(refused);
  expect(result.success).toBe(false);
  const issues = result.error!.issues.map(({ message, path }) => ({ message, path }));
  expect(issues).toHaveLength(1);
  expect(issues[0].message).toBe(NAMED_ERROR);
}

const atNowhere = (value: object) => ({ ...clone(value), dimension: NOWHERE });

describe('DA5a C6: the Dimension record decides what a location may be', () => {
  it('only Nowhere is not a location, only Nowhere uniques drop anywhere', () => {
    for (const dimension of Object.values(EDimension)) {
      expect(DIMENSIONS[dimension].isLocation, dimension).toBe(dimension !== NOWHERE);
      expect(DIMENSIONS[dimension].uniqueDropsAnywhere, dimension).toBe(dimension === NOWHERE);
      expect(locationDimensionSchema.safeParse(dimension).success).toBe(dimension !== NOWHERE);
    }
  });

  it.each(['isLocation', 'uniqueDropsAnywhere'] as const)(
    'a record without a boolean %s is refused',
    (flag) => {
      const record = clone(DIMENSIONS) as unknown as Record<string, Record<string, unknown>>;
      expect(dimensionConfigRecordSchema.safeParse(record).success).toBe(true);
      record[NOWHERE][flag] = 'yes';
      expect(dimensionConfigRecordSchema.safeParse(record).success).toBe(false);
      delete record[NOWHERE][flag];
      expect(dimensionConfigRecordSchema.safeParse(record).success).toBe(false);
    },
  );
});

describe('DA2 B4: location, drawing and recipe schemas refuse nowhere', () => {
  it('B4: the location dimensions refuse nowhere', () => {
    expectNowhereRefused(locationDimensionsSchema, LOCATION_DIMENSIONS, {
      ...LOCATION_DIMENSIONS,
      cave: NOWHERE,
    });
  });

  it('B4: MapRegistry refuses a location definition in nowhere', () => {
    const definition = MapRegistry.get('cave');
    const original = definition.dimension;
    definition.dimension = NOWHERE;
    try {
      expect(() => MapRegistry.get('cave')).toThrow(NAMED_ERROR);
    } finally {
      definition.dimension = original;
    }
    expect(MapRegistry.get('cave').dimension).toBe(EDimension.UNDERWORLD);
  });

  it('B4: a static board drawing in nowhere is refused', () => {
    expectNowhereRefused(StaticBoardDrawingSchema, CAMPING_BOARD, atNowhere(CAMPING_BOARD));
  });

  it('B4: a board recipe in nowhere is refused', () => {
    expectNowhereRefused(RecipeSchema, CAVE_MODEL, atNowhere(CAVE_MODEL));
  });
});

describe('DA2 B5: creature schemas refuse dimension nowhere', () => {
  it('B5: a map creature (squad) in nowhere is refused', () => {
    const squad = CONTENT[HEXOBJECT_KEYS.LONE_SKELETON];
    expectNowhereRefused(ContentDefinitionSchema, squad, atNowhere(squad));
  });

  it('B5: a battle creature in nowhere is refused', () => {
    const creature = BATTLE_CREATURES['skeleton-warrior'];
    expectNowhereRefused(battleCreatureDefSchema, creature, atNowhere(creature));
  });
});
