import { IHexTile } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

export function calcHexPixelPosition(
    tile: IHexTile,
    tileWidth: number,
    spacing = 0.97
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
