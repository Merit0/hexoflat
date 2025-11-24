import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/region-config-interface";

export const homelandMapConfig: IHexMapConfig[] = [
    {
        key: 'battle',
        placeType: 'enemy',
        description: 'Skeletor',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/skeletor-head-image.png'],
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        key: 'camping',
        placeType: 'home',
        description: 'Here You will find peace!',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/house-tile-image.png'],
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
    },
];