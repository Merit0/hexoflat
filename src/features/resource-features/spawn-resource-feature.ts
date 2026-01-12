import HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import { HexObjectFactory } from "@/factory/hex-object-factory";

export class SpawnResourceFeature {
    private readonly map: HexMapModel;

    constructor(mapModel: HexMapModel) {
        this.map = mapModel;
    }

    public spawn(now = Date.now()): boolean {
        let changed = false;

        for (const tile of this.map.tiles) {
            const s = tile.resourceSpawner;
            if (!s?.enabled) continue;
            if (tile.hexobject) continue;

            if (typeof s.nextSpawnAt === "number" && now >= s.nextSpawnAt) {
                tile.hexobject = HexObjectFactory.create(
                    s.proto.hexobjectKey,
                    tile.coordinates,
                    s.proto.overrides
                );
                s.nextSpawnAt = null;
                changed = true;
            }
        }

        return changed;
    }
}