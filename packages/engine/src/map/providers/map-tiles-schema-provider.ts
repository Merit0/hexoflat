import { IHexMapPlacement } from '../../abstraction/hex-map-placement';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';

export const homelandMapConfig: IHexMapPlacement[] = [
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } },
    coordinates: [
      { rowIndex: 4, columnIndex: 15 },
      { rowIndex: 4, columnIndex: 16 },
      { rowIndex: 5, columnIndex: 15 },
      { rowIndex: 5, columnIndex: 16 },
    ],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.HEALTH_BOTTLE },
    coordinates: [{ rowIndex: 0, columnIndex: 10 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.MANA_BOTTLE },
    coordinates: [{ rowIndex: 0, columnIndex: 15 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE },
    coordinates: [{ rowIndex: 0, columnIndex: 25 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
    coordinates: [
      { rowIndex: 0, columnIndex: 26 },
      { rowIndex: 1, columnIndex: 26 },
      { rowIndex: 1, columnIndex: 25 },
      { rowIndex: 0, columnIndex: 24 },
    ],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.ENERGY_BOTTLE },
    coordinates: [{ rowIndex: 0, columnIndex: 20 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
    coordinates: [{ rowIndex: 5, columnIndex: 13 }],
  },
];

export const campingMapConfig: IHexMapPlacement[] = [
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE },
    coordinates: [{ rowIndex: 0, columnIndex: 1 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.AXE },
    coordinates: [{ rowIndex: 2, columnIndex: 7 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.SWORD },
    coordinates: [{ rowIndex: 1, columnIndex: 7 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.PICKAXE },
    coordinates: [{ rowIndex: 4, columnIndex: 7 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.SHIELD },
    coordinates: [{ rowIndex: 3, columnIndex: 7 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.FIREPLACE },
    coordinates: [{ rowIndex: 2, columnIndex: 5 }],
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.WOOD_AND_LEAVES },
    coordinates: [
      { rowIndex: 0, columnIndex: 0 },
      { rowIndex: 0, columnIndex: 2 },
      { rowIndex: 0, columnIndex: 3 },
      { rowIndex: 0, columnIndex: 4 },
      { rowIndex: 0, columnIndex: 5 },
      { rowIndex: 0, columnIndex: 6 },
      { rowIndex: 0, columnIndex: 7 },
      { rowIndex: 0, columnIndex: 8 },

      { rowIndex: 0, columnIndex: 9 },
      { rowIndex: 1, columnIndex: 0 },
      { rowIndex: 1, columnIndex: 9 },
      { rowIndex: 2, columnIndex: 0 },
      { rowIndex: 2, columnIndex: 9 },
      { rowIndex: 3, columnIndex: 0 },
      { rowIndex: 3, columnIndex: 9 },
      { rowIndex: 4, columnIndex: 0 },
      { rowIndex: 4, columnIndex: 9 },
      { rowIndex: 5, columnIndex: 9 },

      { rowIndex: 5, columnIndex: 0 },
      { rowIndex: 5, columnIndex: 1 },
      { rowIndex: 5, columnIndex: 2 },
      { rowIndex: 5, columnIndex: 3 },
      { rowIndex: 5, columnIndex: 4 },
      { rowIndex: 5, columnIndex: 5 },
      { rowIndex: 5, columnIndex: 6 },
      { rowIndex: 5, columnIndex: 7 },
      { rowIndex: 5, columnIndex: 8 },
    ],
  },
];

export const skeletorsKingdomMapConfig: IHexMapPlacement[] = [
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE },
    coordinates: [{ rowIndex: 2, columnIndex: 0 }],
    entry: {
      type: 'DEFAULT',
    },
  },
  {
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.SKELETOR },
    coordinates: [{ rowIndex: 2, columnIndex: 15 }],
  },
];
