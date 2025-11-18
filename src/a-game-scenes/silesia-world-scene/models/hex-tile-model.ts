import {TerrainType} from "@/a-game-scenes/silesia-world-scene/interfaces/region-config-interface";

export class HexTileModel {
    q: number;
    r: number;
    terrain: TerrainType;
    imagePath: string;
    regionKey?: string;
    name?: string;
    isBlocked: boolean;
    requiredMyriads: number;

    constructor(q: number, r: number) {
        this.q = q;
        this.r = r;
        this.isBlocked = true;
        this.terrain = 'no-terrain';
        this.imagePath = '';
        this.requiredMyriads = 10;
    }

    setTerrain(type: TerrainType, imagePath: string, regionKey?: string, name?: string, requiredMyriads?: number) {
        this.terrain = type;
        this.imagePath = imagePath;
        this.regionKey = regionKey;
        if (name) this.name = name;
        if (requiredMyriads !== undefined) {
            this.requiredMyriads = requiredMyriads;
            this.isBlocked = requiredMyriads > 0;
        }
    }

    get id(): string {
        return `${this.q},${this.r}`;
    }
}
