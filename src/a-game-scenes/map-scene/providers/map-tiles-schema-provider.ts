import {IHexMapPlacement} from "@/abstraction/hex-map-placement";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

export const homelandMapConfig: IHexMapPlacement[] = [
    {
        hexobject: {hexobjectKey: HEXOBJECT_KEYS.SKELETOR},
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 25000 } },
        coordinates: [
            { rowIndex: 4, columnIndex: 15 }, { rowIndex: 4, columnIndex: 16 },
            { rowIndex: 5, columnIndex: 15 }, { rowIndex: 5, columnIndex: 16 },
        ],
    },
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
    },
];

export const campingMapConfig: IHexMapPlacement[] = [
    {
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE },
        coordinates: [{ rowIndex: 0, columnIndex: 0 }],
    },
];