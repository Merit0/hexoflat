import {EHexobjectGroup, IResourceTraits, THexobject} from "@/abstraction/hexobject-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";
import type {RouteLocationRaw} from "vue-router";
import {getPrototype, getMeta, type IHexobjectMeta} from "@/content";
import { THeroToolKey } from "@/content/equipment.content";

export interface ToolCapabilities {
    canCut?: boolean;
    canPickup?: boolean;
    canMine?: boolean;
    canEnter?: boolean;
    canUse?: boolean;
    canAttack?: boolean;
    canBlock?: boolean;
}

export type ResolvedActionType =
    | "CUT"
    | "TAKE"
    | "MINE"
    | "USE"
    | "ATTACK"
    | "BLOCK"
    | "OPEN"
    | "ENTER";

export interface ResolvedAction {
    actioType: ResolvedActionType;
    label: string;
    priority: number;
    navigateTo?: RouteLocationRaw;
}

export function getToolCapabilities(toolKey: THeroToolKey): ToolCapabilities {
    const toolProto = getPrototype(toolKey);

    if (!toolProto) return {};

    if (toolProto.groupType !== EHexobjectGroup.TOOL) {
        if (toolProto.groupType === EHexobjectGroup.EQUIPMENT) {
            return {
                canAttack: toolProto.equipment.capabilities?.canAttack,
                canBlock: toolProto.equipment.capabilities?.canBlock,
            };
        }

        return {};
    }

    return toolProto.tool.capabilities ?? {};
}

function labelFromMeta(obj: THexobject, action: EHexActionType, fallback: string): string {
    const key = obj.hexobjectKey;
    if (!key) return fallback;

    const meta: IHexobjectMeta = getMeta(key);
    return meta?.actions?.[action]?.label ?? fallback;
}

export function resolveActions(toolKey: THeroToolKey, obj: THexobject): ResolvedAction[] {
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
        case EHexobjectGroup.EQUIPMENT:
        case EHexobjectGroup.TOOL: {
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

            const meta = getMeta(key);
            const useCfg = meta?.actions?.[EHexActionType.USE];
            const enterCfg = meta?.actions?.[EHexActionType.ENTER];

            if (useCfg) {
                if (!useCfg.requiredTool || useCfg.requiredTool === toolKey) {
                    if (cap.canUse) {
                        resolvedActions.push({
                            actioType: EHexActionType.USE,
                            label: useCfg.label ?? "Use",
                            priority: 95,
                        });
                    }
                }
            }

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
