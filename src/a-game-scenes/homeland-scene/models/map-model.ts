import {Complexity} from "@/enums/complexity";
import {v4 as uuid} from "uuid";

interface IMap {
    readonly name: string;
    readonly uuid: string;
    readonly complexity: Complexity;
    readonly isLocked: boolean;
}

export class MapModel implements IMap {
    private _mapName: string;
    private readonly _mapId: string;
    private _mapComplexity: Complexity;
    private _isLocked: boolean;

    constructor() {
        this._mapId = uuid();
    }

    public get uuid(): string {
        return this._mapId
    }

    public get name(): string {
        return this._mapName;
    }

    set name(mapName: string) {
        this._mapName = mapName;
    }

    get complexity(): Complexity {
        return this._mapComplexity;
    }

    set complexity(complexity: Complexity) {
        this._mapComplexity = complexity;
    }

    get isLocked(): boolean {
        return this._isLocked;
    }

    set isLocked(isLocked: boolean) {
        this._isLocked = isLocked;
    }
}

export default MapModel;