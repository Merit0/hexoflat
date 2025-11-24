import {IHexTile} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

export function calcHexPixelPosition(tile: IHexTile, tileWidth: number, tileHeight: number) {
    const x = tileWidth * (3 / 2) * tile.coordinates.columnIndex;
    const y =
        Math.sqrt(3) * tileHeight * tile.coordinates.rowIndex +
        (tile.coordinates.columnIndex % 2
            ? (Math.sqrt(3) * tileHeight) / 2
            : 0);

    return { x, y };
}
