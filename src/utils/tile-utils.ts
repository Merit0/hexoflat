import { IHexTile } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

export function calcHexPixelPosition(
    tile: IHexTile,
    tileWidth: number
) {
    const q = tile.coordinates.columnIndex;
    const r = tile.coordinates.rowIndex;

    const x = tileWidth * (3 / 2) * q;
    const y = tileWidth * Math.sqrt(3) * (r + (q % 2 ? 0.5 : 0));

    return { x, y };
}
