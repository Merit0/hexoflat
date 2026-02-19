import {IHexMapPlacement} from "@/abstraction/hex-map-placement";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

export const homelandMapConfig: IHexMapPlacement[] = [
    {
        hexobject: {hexobjectKey: HEXOBJECT_KEYS.SKELETOR},
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        hexobject: {hexobjectKey: HEXOBJECT_KEYS.EMITTER},
        coordinates: [{ rowIndex: 0, columnIndex: 9 }],
    },
    {
        hexobject: {hexobjectKey: HEXOBJECT_KEYS.INFERNO},
        coordinates: [{ rowIndex: 7, columnIndex: 22 }],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } },
        coordinates: [
            { rowIndex: 4, columnIndex: 15 }, { rowIndex: 4, columnIndex: 16 },
            { rowIndex: 5, columnIndex: 15 }, { rowIndex: 5, columnIndex: 16 },
        ],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.HEALTH_BOTTLE },
        coordinates: [
            { rowIndex: 0, columnIndex: 10 },
        ],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.MANA_BOTTLE },
        coordinates: [
            { rowIndex: 0, columnIndex: 15 },
        ],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.ENERGY_BOTTLE },
        coordinates: [
            { rowIndex: 0, columnIndex: 20 },
        ],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
        entry: { type: "DEFAULT", spawn: "default" },
    },
];

export const campingMapConfig: IHexMapPlacement[] = [
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE },
        coordinates: [{ rowIndex: 0, columnIndex: 0 }],
        entry: { type: "DEFAULT", spawn: "default" },
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.FIREPLACE },
        coordinates: [{ rowIndex: 2, columnIndex: 5 }]
    },
];