import {Complexity} from "@/enums/complexity";
import HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";

interface IHexMapBuilder {
    name(mapName: string): this;
    complexity(mapComplexity: Complexity): this;
    width(mapWidth: number): this;
    height(height: number): this;
    config(mapTilesConfig: IHexMapConfig[]): this;
}

export class HexMapBuilder implements IHexMapBuilder {
    private draft: HexMapModel = new HexMapModel();

    public name(mapName: string): this {
        this.draft.name = mapName;

        return this;
    }

    public complexity(mapComplexity: Complexity): this {
        this.draft.complexity = mapComplexity;

        return this;
    }

    public width(mapWidth: number): this {
        this.draft.width = mapWidth;

        return this;
    }

    public height(mapHeight: number): this {
        this.draft.height = mapHeight;

        return this;
    }

    public config(mapTilesConfig: IHexMapConfig[]): this {
        this.draft.config = mapTilesConfig;

        return this;
    }

    private reset(): void {
        this.draft = new HexMapModel();
    }

    build(): HexMapModel {
        const map = new HexMapModel();

        map.name = this.draft.name;
        map.complexity = this.draft.complexity;
        map.width = this.draft.width;
        map.height = this.draft.height;
        map.config = this.draft.config;
        map.generateTiles();
        if (!map.tiles.length) throw new Error("Tiles were not generated.");

        this.reset();

        return map;
    }
}