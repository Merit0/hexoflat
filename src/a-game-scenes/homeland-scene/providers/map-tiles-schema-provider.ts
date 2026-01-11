import {ROUTES} from "@/router/routes";
import {IHexMapPlacement} from "@/abstraction/hex-map-placement";

export const homelandMapConfig: IHexMapPlacement[] = [
    {
        hexobject: {hexobjectKey: 'skeletor'},
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        hexobject: { hexobjectKey: "tree", overrides: { regrowMs: 1000 * 60 * 5 } },
        coordinates: [
            { rowIndex: 4, columnIndex: 15 }, { rowIndex: 4, columnIndex: 16 },
            { rowIndex: 5, columnIndex: 15 }, { rowIndex: 5, columnIndex: 16 },
        ],
    },
    {
        rootPathKey: ROUTES.CAMPING,
        hexobject: { hexobjectKey: "camping" },
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
    },
];