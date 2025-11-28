import {ChestModel} from "@/models/ChestModel";
import EnemyModel from "../../../models/EnemyModel";
import {HeroModel} from "@/models/HeroModel";
import {LootItemModel} from "@/models/LootItemModel";
import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
// import {DungeonModel} from "@/a-game-scenes/dungeon-scene/dungeon-model";


export interface ITile {
    id: number;
    enemies: EnemyModel[];
    isInitial: boolean;
    inBattle: boolean;
    isCamping: boolean;
    imageSrc: string;
    backgroundSrc: string;
    hero?: HeroModel;
    chest?: ChestModel;
    // grave?: GraveModel;
    // dungeon?: DungeonModel;
    coordinates: IHexCoordinates;
    isReachable: boolean;
    isHeroHere: boolean;
    isEnemyHere: boolean;
    isBlocked: boolean;
    isDungeon: boolean;
    isExit: boolean;
}

export class TileModel implements ITile {
    id: number;
    enemies: EnemyModel[] = [];
    imageSrc = '';
    backgroundSrc = '';
    isInitial = false;
    isCamping = false;
    inBattle = false;
    hero?: HeroModel;
    // grave?: GraveModel;
    // dungeon: DungeonModel;
    coordinates: IHexCoordinates;
    isReachable = false;
    isHeroHere = false;
    isEnemyHere = false;
    isBlocked = false;
    isGrave = false;
    isDungeon = false;
    isExit = false;

    constructor(id: number, coordinates: IHexCoordinates) {
        this.id = id;
        this.coordinates = coordinates;
    }

    setImageSrc(path: string) {
        this.imageSrc = path;
    }

    setBackgroundSrc(path: string) {
        this.backgroundSrc = path;
    }

    setIsInitial(status: boolean) {
        this.isInitial = status;
    }

    setIsExit(status: boolean) {
        this.isExit = status;
    }

    // setDungeon(dungeonModel: DungeonModel) {
    //     this.dungeon = dungeonModel;
    // }

    setEnemies(enemies: EnemyModel[]) {
        this.enemies = enemies;
        this.isEnemyHere = enemies.some(e => e.health > 0);
    }

    setHero(hero: HeroModel) {
        this.hero = hero;
    }

    get isEmpty(): boolean {
        return !this.isHeroHere &&
            !this.isEnemyHere &&
            !this.isInitial &&
            !this.isDungeon;
    }

    // static mapToModel(data: any): TileModel {
    //     const tile = new TileModel(data.id, data.coordinates);
    //     Object.assign(tile, data);
    //
    //     if (Array.isArray(data.enemies)) {
    //         tile.enemies = data.enemies.map((e: any) => EnemyModel.mapToModel(e));
    //     }
    //
    //     if (data.grave) {
    //         const grave = new GraveModel();
    //         grave.graveImgPath = data.grave.graveImgPath;
    //
    //         if (Array.isArray(data.grave.graveTreasureItems)) {
    //             grave.graveTreasureItems = data.grave.graveTreasureItems.map(
    //                 (i: any) => LootItemModel.mapToModel(i)
    //             );
    //         }
    //
    //         tile.grave = grave;
    //         tile.isGrave = true;
    //     }
    //
    //     return tile;
    // }
}

export default TileModel;
