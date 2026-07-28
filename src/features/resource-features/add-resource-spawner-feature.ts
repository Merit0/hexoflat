import {EHexobjectGroup} from "@/abstraction/hexobject-abstraction";
import { getPrototype } from "@/content";
import {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {HexObjectPlacementRef} from "@/abstraction/hex-map-placement";

export class AddResourceSpawnerFeature {
    private readonly hex: HexTileModel;
    private readonly resourceReference: HexObjectPlacementRef;

    constructor(hex: HexTileModel, placementHexobject: HexObjectPlacementRef) {
        this.hex = hex;
        this.resourceReference = placementHexobject;
    }

    public add() {
        const proto = getPrototype(this.resourceReference.hexobjectKey);
        if (!proto) return;

        if (proto.groupType !== EHexobjectGroup.RESOURCE) return;

        const regrowMs =
            (this.resourceReference.overrides?.regrowMs as number | undefined) ??
            (proto.resource?.regrowMs as number | undefined);

        if (!regrowMs) return;

        this.hex.resourceSpawner = {
            proto: this.resourceReference,
            regrowMs,
            nextSpawnAt: null,
            enabled: true,
        };
    }
}