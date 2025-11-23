import {
    IHexCoordinates,
    IHexMapConfig,
} from '@/a-game-scenes/homeland-scene/interfaces/region-config-interface';

function generateAllEmptyCoordinates(rows: number, cols: number): IHexCoordinates[] {
    const coords: IHexCoordinates[] = [];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            coords.push({rowIndex: row, columnIndex: col});
        }
    }

    return coords;
}

const setCoordinates = (rowIndex: number, columnIndex: number) =>
    ({rowIndex, columnIndex} as const);


const baseEmpty: IHexMapConfig =
    {
        key: '',
        place: 'empty',
        name: 'Nothing around',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png'],
        coordinates: generateAllEmptyCoordinates(11, 27),
    };
const objectsLayer: IHexMapConfig[] = [
    {
        key: 'boss-homeland',
        place: 'enemy',
        name: 'Skeletor',
        images: ['src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/skeletor-head-image.png'],
        coordinates: [setCoordinates(3, 5)],
    },
    {
        key: 'camping',
        place: 'home',
        name: 'Home Entrance',
        images: [],
        coordinates: [setCoordinates(0, 13)],
    },
];

export const homelandPlacesConfig: IHexMapConfig[] = [
    baseEmpty,
    ...objectsLayer,
];

export default homelandPlacesConfig;