import type HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import { HexMapProvider } from "@/a-game-scenes/map-scene/providers/hex-map-provider";
import {HEXOBJECT_KEYS, THexobjectKey} from "@/registry/hexobjects-registry";

export type LocationKey = "camping" | "homeland";

export type MapDefinition = {
    key: LocationKey;
    title: string;
    create: () => HexMapModel;
    entryHexobjectKey: THexobjectKey;
    safeZoneRadius?: number;
};

export class MapRegistry {
    private static defs: Record<LocationKey, MapDefinition> = {
        camping: {
            key: 'camping',
            title: 'Camping',
            create: () => HexMapProvider.getCamping(),
            entryHexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
            safeZoneRadius: 1,
        },
        homeland: {
            key: "homeland",
            title: 'Silesia',
            create: () => HexMapProvider.getHomeLand(),
            entryHexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
            safeZoneRadius: 1,
        },
    };

    static get(key: LocationKey): MapDefinition {
        return this.defs[key];
    }
}