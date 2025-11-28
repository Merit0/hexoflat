import type {HexTileType, IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {RouteName} from "@/router/routes";

type HexTileDraft = Partial<Pick<
    HexTileModel,
    "tileKey" | "tileType" | "imagePath" | "description" | "coordinates"
>>;

export class HexTileBuilder {
    private draft: HexTileDraft = {};

    routeKey(tileKey: RouteName): this {
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
        console.log('DRAFT type' + this.draft.tileType)

        const tile = new HexTileModel();

        tile.tileKey = this.draft.tileKey;
        tile.tileType = this.draft.tileType ?? tile.tileType;
        tile.coordinates = this.draft.coordinates;
        tile.imagePath = this.draft.imagePath ?? "";
        tile.description = this.draft.description ?? tile.description;

        this.reset();

        return tile;
    }
}