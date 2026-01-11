import { coordinateKey } from "@/utils/hex-utils";
import type { IHexCoordinates } from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import { EHexobjectGroup, type THexobject, type THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { HEX_OBJECT_PROTOTYPES } from "@/game-prototypes/hexobject-prototypes";

export class HexObjectFactory {
    static create(key: string, coord: IHexCoordinates, overrides?: Record<string, any>): THexobject {
        const proto = HEX_OBJECT_PROTOTYPES[key];

        if (!proto) {
            throw new Error(`Unknown Hexobject key: ${key}`);
        }

        const base = structuredClone(proto) as THexobjectPrototype;
        const id = `${coordinateKey(coord)}:${key}`;
        const built: THexobject = { ...(base as any), id };

        if (overrides) {
            this.applyOverrides(built, overrides);
        }

        return built;
    }

    private static applyOverrides(obj: THexobject, overrides: Record<string, any>) {
        if (obj.groupType === EHexobjectGroup.RESOURCE) {
            if (typeof overrides.regrowMs === "number") obj.resource.regrowMs = overrides.regrowMs;
            if (typeof overrides.amount === "number") obj.resource.amount = overrides.amount;
            if (typeof overrides.isAvailable === "boolean") obj.resource.isAvailable = overrides.isAvailable;
            if (typeof overrides.regrowAt === "number" || overrides.regrowAt === null) obj.resource.regrowAt = overrides.regrowAt;
        }

        if (obj.groupType === EHexobjectGroup.TOOL) {
            if (typeof overrides.durability === "number") obj.tool.durability = overrides.durability;
            if (typeof overrides.durabilityMax === "number") obj.tool.durabilityMax = overrides.durabilityMax;
        }
    }
}