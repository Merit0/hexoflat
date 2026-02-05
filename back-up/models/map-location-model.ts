import {Complexity} from "@/enums/complexity";
import {IHero} from "@/abstraction/hero-abstraction";
import {v4 as uuid} from "uuid";
import EnemyModel from "@/models/EnemyModel";

export interface IMapLocation {
    readonly name: string;
    readonly tilesNumber: number;
    readonly enemyModifier: number;
    readonly uuid: string;
    readonly complexity: Complexity;
    readonly hero: IHero;
    readonly imgPath: string;
    readonly endPoint: string;
    readonly tileImage: string;
    readonly tileBackgroundSrc: string;
    readonly boss: EnemyModel;
    readonly dungeonName: string;
    readonly mapTilesSchema: {
        rows: number,
        columns: number
    };
    readonly withCamping: boolean;
    readonly heroStartPointTileIndex: number;
    readonly enemies: EnemyModel[];
}

export class MapLocationModel implements IMapLocation {
    private _locationName: string;
    private _tilesNumber: number;
    private _enemyModifier: number;
    private readonly _id: string;
    private _imgPath: string;
    private _endPoint: string;
    private _tileImage: string;
    private _tileBackgroundSrc: string;
    private _complexity: Complexity;
    private _hero: IHero;
    private _bose: EnemyModel;
    private _enemies: EnemyModel[];
    private _dungeonName: string;
    private _mapTilesSchema = {rows: 5, columns: 5};
    private _withCamping = false;
    private _heroStartPointTileIndex = 0;

    constructor() {
        this._id = uuid();
    }

    get uuid(): string {
        return this._id;
    }

    get tileImage(): string {
        return this._tileImage;
    }

    set tileImage(tileImagePath: string) {
        this._tileImage = tileImagePath;
    }

    get heroStartPointTileIndex(): number {
        return this._heroStartPointTileIndex;
    }

    set heroStartPointTileIndex(tileIndex: number) {
        this._heroStartPointTileIndex = tileIndex;
    }

    get tileBackgroundSrc(): string {
        return this._tileBackgroundSrc;
    }

    set tileBackgroundSrc(tileBackgroundSrcPath: string) {
        this._tileBackgroundSrc = tileBackgroundSrcPath;
    }

    get name(): string {
        return this._locationName;
    }

    set name(name: string) {
        this._locationName = name;
    }

    get withCamping(): boolean {
        return this._withCamping;
    }

    set withCamping(withCamping: boolean) {
        this._withCamping = withCamping;
    }

    get mapTilesSchema(): { rows: number, columns: number } {
        return this._mapTilesSchema;
    }

    set mapTilesSchema(schemaTiles: { rows: number, columns: number }) {
        this._mapTilesSchema.rows = schemaTiles.rows;
        this._mapTilesSchema.columns = schemaTiles.columns;
    }

    get dungeonName(): string {
        return this._dungeonName;
    }

    set dungeonName(dungeonName: string) {
        this._dungeonName = dungeonName;
    }

    get tilesNumber(): number {
        return this._tilesNumber
    }

    set tilesNumber(numberOfTiles: number) {
        this._tilesNumber = numberOfTiles;
    }

    get enemyModifier(): number {
        return this._enemyModifier
    }

    set enemyModifier(enemyModifier: number) {
        this._enemyModifier = enemyModifier;
    }

    get hero(): IHero {
        return this._hero;
    }

    set hero(hero: IHero) {
        this._hero = hero;
    }

    get boss(): EnemyModel {
        return this._bose;
    }

    set boss(bossModel: EnemyModel) {
        this._bose = bossModel;
    }

    get complexity(): Complexity {
        return this._complexity;
    }

    set complexity(complexityValue: Complexity) {
        this._complexity = complexityValue;
    }

    get imgPath(): string {
        return this._imgPath;
    }

    set imgPath(path: string) {
        this._imgPath = path;
    }

    get endPoint(): string {
        return this._endPoint;
    }

    set endPoint(endPointPath: string) {
        this._endPoint = endPointPath;
    }

    get enemies(): EnemyModel[] {
        return this._enemies;
    }

    set enemies(enemies: EnemyModel[]) {
        this._enemies = enemies;
    }
}