import type { RouteName } from "@/router/routes";
import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";

export interface HexObjectPlacementRef {
    hexobjectKey: string;
    overrides?: Record<string, any>;
}

export interface IHexMapPlacement {
    rootPathKey?: RouteName;
    initialTileImage?: string;
    description?: string;
    hexobject?: HexObjectPlacementRef;
    coordinates: IHexCoordinates[];
}