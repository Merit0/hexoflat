import {HexTileType} from "@/a-game-scenes/silesia-world-scene/interfaces/region-config-interface";

export class HexTileModel {
    q: number;
    r: number;
    place: HexTileType;
    imagePath: string;
    placeKey?: string;
    name?: string;
    isBlocked: boolean;
    requiredMyriads: number;

    constructor(q: number, r: number) {
        this.q = q;
        this.r = r;
        this.isBlocked = true;
        this.place = 'empty';
        this.imagePath = '';
        this.requiredMyriads = 10;
    }

    setupPlace(placeType: HexTileType, imagePath: string, placeKey?: string, name?: string, requiredMyriads?: number) {
        this.place = placeType;
        this.imagePath = imagePath;
        this.placeKey = placeKey;
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
