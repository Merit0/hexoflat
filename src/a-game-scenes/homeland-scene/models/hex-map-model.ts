import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/region-config-interface";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";

export class HexMapModel {
    name: string;
    width: number;
    height: number;
    places: IHexMapConfig[];
    tiles: HexTileModel[] = [];

    constructor(name: string, width: number, height: number, places: IHexMapConfig[]) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.places = places;
    }
}