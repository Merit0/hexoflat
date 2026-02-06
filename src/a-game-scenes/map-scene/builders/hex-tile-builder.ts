import type {IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";

type HexTileDraft = Partial<Pick<
    HexTileModel,
    'tileId'
    | 'coordinates'
    | 'isRevealed'
    | 'hexBackgroundImagePath'
>>;

export class HexTileBuilder {
    private draft: HexTileDraft = {};

    isRevealed(revealedStatus: boolean): this {
        this.draft.isRevealed = revealedStatus;
        return this;
    }

    hexBackgroundImagePath(hexBackgroundImagePath: string): this {
        this.draft.hexBackgroundImagePath = hexBackgroundImagePath;
        return this;
    }

    coordinates(coordinates: IHexCoordinates): this {
        this.draft.coordinates = coordinates;
        return this;
    }

    private reset(): this {
        this.draft = {};
        return this;
    }

    build(): HexTileModel {
        if (!this.draft.coordinates) throw new Error("HexTileBuilder: coordinates are required");

        const tile = new HexTileModel();

        tile.isRevealed = this.draft.isRevealed ?? false;
        tile.coordinates = this.draft.coordinates;
        tile.hexBackgroundImagePath = this.draft.hexBackgroundImagePath ?? "";

        this.reset();

        return tile;
    }
}