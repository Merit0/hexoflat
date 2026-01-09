import type { HexObjectModel } from "@/models/hexobject-model";
import type { HeroToolType } from "@/stores/hero-tool-store";

export interface ToolCapabilities {
    canCut?: boolean;
    canPickup?: boolean;
}

export type InteractionActionId = "CUT" | "PICKUP";

export interface ResolvedAction {
    id: InteractionActionId;
    label: string;
    requiresConfirm: boolean;
}

export function getToolCapabilities(tool: HeroToolType): ToolCapabilities {
    if (tool === "axe") return { canCut: true };
    return { canPickup: true };
}

export function resolveActions(tool: HeroToolType, obj: HexObjectModel): ResolvedAction[] {
    if (!obj.isAvailable || !obj.isInteractable) return [];

    const cap = getToolCapabilities(tool);
    const resolvedActions: ResolvedAction[] = [];

    if (cap.canCut && obj.traits.collectable && obj.traits.cuttable) {
        resolvedActions.push({ id: "CUT", label: "Cut", requiresConfirm: true });
    }

    if (cap.canPickup && obj.traits.collectable && obj.traits.pickupable) {
        resolvedActions.push({ id: "PICKUP", label: "Take", requiresConfirm: false });
    }

    return resolvedActions;
}