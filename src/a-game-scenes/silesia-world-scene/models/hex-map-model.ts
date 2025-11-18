import {IRegionConfig} from "@/a-game-scenes/silesia-world-scene/interfaces/region-config-interface";
import {HexTileModel} from "@/a-game-scenes/silesia-world-scene/models/hex-tile-model";

export class HexMapModel {
    name: string;
    width: number;
    height: number;
    regions: IRegionConfig[];
    tiles: HexTileModel[] = [];

    constructor(name: string, width: number, height: number, regions: IRegionConfig[]) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.regions = regions;
    }
}