import type { RouteName } from "@/router/routes";
import {IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {THexobjectKey} from "@/registry/hexobjects-registry";

export interface HexObjectPlacementRef {
    hexobjectKey: THexobjectKey;
    overrides?: Record<string, any>;
}

export interface IHexMapPlacement {
    rootPathKey?: RouteName;
    initialTileImage?: string;
    description?: string;
    hexobject?: HexObjectPlacementRef;
    coordinates: IHexCoordinates[];
}