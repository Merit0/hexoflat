import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {ROUTES} from "@/router/routes";

export const homelandMapConfig: IHexMapConfig[] = [
    {
        tileType: 'enemy',
        description: 'Skeletor',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/skeletor-boss-image.png'],
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        tileType: 'empty',
        description: 'The Tree can be cut!',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/tree-tile-image.png'],
        hexobject: {
            id: '',
            kind: 'tree',
            isAvailable: true,
            isInteractable: true,
            regrowMs: 1000 * 60 * 5,
            description: 'This tree can be chopped!',
            traits: {
                collectable: true,
                cuttable: true },
        },
        coordinates: [
            { rowIndex: 4, columnIndex: 15 }, { rowIndex: 4, columnIndex: 16 },
            { rowIndex: 5, columnIndex: 15 }, { rowIndex: 5, columnIndex: 16 },
        ],
    },
    {
        key: ROUTES.CAMPING,
        tileType: 'home',
        description: 'Here You will find peace!',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/house-tile-image.png'],
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
    },
];