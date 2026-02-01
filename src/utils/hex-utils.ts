import {IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { IHexTile } from "@/a-game-scenes/map-scene/models/hex-tile-model";

// odd-q offset -> axial
function oddQToAxial(c: IHexCoordinates) {
    const q = c.columnIndex;
    const r = c.rowIndex - ((q - (q & 1)) / 2);
    return { q, r };
}

// axial -> odd-q offset
function axialToOddQ(a: { q: number; r: number }): IHexCoordinates {
    const columnIndex = a.q;
    const rowIndex = a.r + ((columnIndex - (columnIndex & 1)) / 2);
    return { columnIndex, rowIndex };
}

const AXIAL_DIRS = [
    { q: +1, r:  0 },
    { q: +1, r: -1 },
    { q:  0, r: -1 },
    { q: -1, r:  0 },
    { q: -1, r: +1 },
    { q:  0, r: +1 },
] as const;

export function getOddQNeighbors(center: IHexCoordinates): IHexCoordinates[] {
    const a = oddQToAxial(center);
    return AXIAL_DIRS.map(d => axialToOddQ({ q: a.q + d.q, r: a.r + d.r }));
}

export function coordinateKey(c: IHexCoordinates): string {
    return `${c.columnIndex}:${c.rowIndex}`;
}

export function calcHexPixelPosition(
    tile: IHexTile,
    tileWidth: number,
    spacing = 0.93
) {
    const q = tile.coordinates.columnIndex;
    const r = tile.coordinates.rowIndex;

    const x = tileWidth * 1.5 * spacing * q;
    const y =
        tileWidth *
        Math.sqrt(3) *
        spacing *
        (r + (q % 2 ? 0.5 : 0));

    return { x, y };
}