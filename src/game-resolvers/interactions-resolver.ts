import type {HeroToolType} from "@/stores/hero-tool-store";
import {EHexCollision, EHexobjectGroup, THexobject} from "@/abstraction/hexobject-abstraction";

export interface ToolCapabilities {
    canCut?: boolean;
    canPickup?: boolean;
    canMine?: boolean;
}

export type ResolvedActionType = "CUT" | "PICKUP" | "MINE" | "ATTACK" | "OPEN";

export interface ResolvedAction {
    actioType: ResolvedActionType;
    label: string;
    priority: number;
}

export function getToolCapabilities(tool: HeroToolType): ToolCapabilities {
    switch (tool) {
        case "axe": return { canCut: true };
        case "pickaxe": return { canMine: true };
        case "hand": return { canPickup: true };
        default: return {};
    }
}

export function resolveActions(tool: HeroToolType, obj: THexobject): ResolvedAction[] {
    if (!obj.isInteractable) return [];

    if (obj.collision === EHexCollision.OVERLAY) {
        return [
            {actioType: "OPEN", label: "Open", priority: 100},
        ];
    }


    const cap = getToolCapabilities(tool);
    const resolvedActions: ResolvedAction[] = [];

    switch (obj.groupType) {
        case EHexobjectGroup.RESOURCE: {
            if (!obj.resource.isAvailable) return [];

            const traits = obj.resource.traits ?? {};

            if (cap.canCut && traits.cuttable) {
                resolvedActions.push({actioType: "CUT", label: "Chop", priority: 90});
            }

            if (cap.canPickup && (traits.pickupable || traits.collectable)) {
                resolvedActions.push({actioType: "PICKUP", label: "Take", priority: 80});
            }

            if (cap.canMine && traits.mineable) {
                resolvedActions.push({actioType: "MINE", label: "Get", priority: 85});
            }

            break;
        }

        case EHexobjectGroup.CREATURE: {
            resolvedActions.push({actioType: "ATTACK", label: "Attack", priority: 70});
            break;
        }

        case EHexobjectGroup.CONSTRUCTION: {
            resolvedActions.push({actioType: "OPEN", label: "Enter", priority: 60});
            break;
        }

        case EHexobjectGroup.TOOL:
        case EHexobjectGroup.WEAPON: {
            if (obj.collision === EHexCollision.TRIGGER && cap.canPickup) {
                resolvedActions.push({actioType: "PICKUP", label: "Take", priority: 80});
            }
            break;
        }

        default:
            break;
    }

    return resolvedActions;
}