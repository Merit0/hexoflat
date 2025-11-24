import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/region-config-interface";

export const homelandMapConfig: IHexMapConfig[] = [
    {
        key: 'boss-homeland',
        placeType: 'enemy',
        description: 'Skeletor',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/skeletor-head-image.png'],
        coordinates: [{ rowIndex: 3, columnIndex: 5 }],
    },
    {
        key: 'camping',
        placeType: 'home',
        description: 'Home Entrance',
        images: [],
        coordinates: [{ rowIndex: 0, columnIndex: 13 }],
    },
];