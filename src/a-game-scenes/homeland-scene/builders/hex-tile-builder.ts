import type {HexTileType, IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/region-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

type HexTileDraft = Partial<Pick<
    HexTileModel,
    "tileKey" | "tileType" | "imagePath" | "description" | "coordinates"
>>;

export class HexTileBuilder {
    private draft: HexTileDraft = {};

    key(tileKey: string): this {
        this.draft.tileKey = tileKey;
        return this;
    }

    type(tileType: HexTileType): this {
        this.draft.tileType = tileType;
        return this;
    }

    imagePath(imagePath: string): this {
        this.draft.imagePath = imagePath;
        return this;
    }

    description(descriptionTile: string): this {
        this.draft.description = descriptionTile;
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

        tile.tileKey = this.draft.tileKey;
        tile.tileType = this.draft.tileType;
        tile.coordinates = this.draft.coordinates;
        tile.imagePath = this.draft.imagePath ?? "";
        tile.description = this.draft.description ?? "";

        this.reset();

        return tile;
    }
}