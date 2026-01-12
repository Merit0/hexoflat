import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { HexTileModel } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { getToolCapabilities } from "@/game-resolvers/interactions-resolver";
import { HeroToolType } from "@/enums/hero-tool-type";

export class CutResourceFeature {
    private readonly hex: HexTileModel;
    private readonly heroTool: HeroToolType;

    constructor(hex: HexTileModel, heroTool: HeroToolType) {
        this.hex = hex;
        this.heroTool = heroTool;
    }

    public cut(now = Date.now()) {
        console.log("Started cutting Resource...");

        const obj = this.hex.hexobject;
        if (!obj) {
            console.log("No Hexobject on tile.");
            return { ok: false, message: "No Hexobject on tile." };
        }

        const pendingAction = this.hex.pendingAction;
        if (pendingAction && Date.now() < pendingAction.endsAt) {
            console.log("Tile is busy.");
            return { ok: false, message: "Tile is busy." };
        }

        if (obj.groupType !== EHexobjectGroup.RESOURCE) {
            return { ok: false, message: "Hexobject is not a resource." };
        }

        if (!obj.resource?.traits?.cuttable) {
            return { ok: false, message: "Resource is not cuttable." };
        }

        const cap = getToolCapabilities(this.heroTool);
        if (!cap.canCut) {
            return { ok: false, message: "Need Axe!" };
        }

        const heroToolStore = useHeroToolStore();
        const okDurability = heroToolStore.consumeDurability(0.1);
        if (!okDurability) {
            heroToolStore.activeTool = HeroToolType.HAND;
            return { ok: false, message: "Tool broken." };
        }

        this.hex.pendingAction = {
            type: "CUT",
            startedAt: now,
            endsAt: now + 5000,
            hexobjectKey: obj.hexobjectKey,
        };

        console.log("Cut started (5s)...");
        return { ok: true };
    }
}