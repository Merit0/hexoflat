import {EHexobjectGroup, IResourceTraits, THexobject} from "@/abstraction/hexobject-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";
import type {RouteLocationRaw} from "vue-router";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";
import {HEX_OBJECT_PROTOTYPES} from "@/registry/hexobjects/prototypes";
import {TToolKeys} from "@/registry/hexobjects/prototypes/tools.prototypes";

export interface ToolCapabilities {
    canCut?: boolean;
    canPickup?: boolean;
    canMine?: boolean;
    canEnter?: boolean;
}

export type ResolvedActionType =
    | "CUT"
    | "TAKE"
    | "MINE"
    | "ATTACK"
    | "OPEN"
    | "ENTER";

export interface ResolvedAction {
    actioType: ResolvedActionType;
    label: string;
    priority: number;
    navigateTo?: RouteLocationRaw;
}

export function getToolCapabilities(toolKey: TToolKeys): ToolCapabilities {
    const toolProto = HEX_OBJECT_PROTOTYPES[toolKey];

    if (!toolProto) return {};

    if (toolProto.groupType !== EHexobjectGroup.TOOL) {
        return {};
    }

    return toolProto.tool.capabilities ?? {};
}

function labelFromMeta(obj: THexobject, action: EHexActionType, fallback: string): string {
    const key = obj.hexobjectKey;
    if (!key) return fallback;

    const meta: IHexobjectMeta = HEXOBJECT_META[key];
    return meta?.actions?.[action]?.label ?? fallback;
}

export function resolveActions(toolKey: TToolKeys, obj: THexobject): ResolvedAction[] {
    if (!obj.isInteractable) return [];

    const cap = getToolCapabilities(toolKey);
    const resolvedActions: ResolvedAction[] = [];

    switch (obj.groupType) {
        case EHexobjectGroup.RESOURCE: {
            if (!obj.resource.isAvailable) break;

            const traits: IResourceTraits = obj.resource.traits ?? {};

            if (cap.canCut && traits.cuttable) {
                resolvedActions.push({
                    actioType: "CUT",
                    label: labelFromMeta(obj, EHexActionType.CUT, "Chop"),
                    priority: 90,
                });
            }

            if (cap.canPickup && traits.pickable) {
                resolvedActions.push({
                    actioType: "TAKE",
                    label: labelFromMeta(obj, EHexActionType.TAKE, "Take"),
                    priority: 80,
                });
            }

            if (cap.canMine && traits.mineable) {
                resolvedActions.push({
                    actioType: "MINE",
                    label: labelFromMeta(obj, EHexActionType.MINE, "Mine"),
                    priority: 85,
                });
            }

            break;
        }

        case EHexobjectGroup.LOOT: {
            const amount = obj.loot?.amount ?? 0;
            if (amount <= 0) break;
            if (!cap.canPickup) break;

            resolvedActions.push({
                actioType: "TAKE",
                label: labelFromMeta(obj, EHexActionType.TAKE, "Take"),
                priority: 90,
            });
            break;
        }

        case EHexobjectGroup.CREATURE: {
            resolvedActions.push({
                actioType: "ATTACK",
                label: labelFromMeta(obj, EHexActionType.ATTACK, "Attack"),
                priority: 70,
            });
            break;
        }

        case EHexobjectGroup.CONSTRUCTION: {
            const key = obj.hexobjectKey;
            if (!key) break;

            const meta = HEXOBJECT_META[key];
            const enterCfg = meta?.actions?.[EHexActionType.ENTER];

            if (enterCfg) {
                if (enterCfg.requiredTool && enterCfg.requiredTool !== toolKey) break;

                if (!cap.canEnter) break;

                resolvedActions.push({
                    actioType: EHexActionType.ENTER,
                    label: enterCfg.label ?? "Enter",
                    priority: 100,
                });
            }

            break;
        }

        default:
            break;
    }

    resolvedActions.sort((a, b) => b.priority - a.priority);
    return resolvedActions;
}