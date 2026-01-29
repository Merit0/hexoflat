import {EHexCollision, EHexobjectGroup, IResourceTraits, THexobject} from "@/abstraction/hexobject-abstraction";
import {HeroToolType} from "@/enums/hero-tool-type";
import {EHexActionType} from "@/enums/hex-action-type";
import {HEXOBJECT_META, HexobjectMeta} from "@/registry/hexobject-meta";

export interface ToolCapabilities {
    canCut?: boolean;
    canPickup?: boolean;
    canMine?: boolean;
}

export type ResolvedActionType = "CUT" | "TAKE" | "MINE" | "ATTACK" | "OPEN";

export interface ResolvedAction {
    actioType: ResolvedActionType;
    label: string;
    priority: number;
}

export const RESOLVED_TO_HEX_ACTION: Record<ResolvedActionType, EHexActionType> = {
    CUT: EHexActionType.CUT,
    TAKE: EHexActionType.TAKE,
    MINE: EHexActionType.MINE,
    ATTACK: EHexActionType.ATTACK,
    OPEN: EHexActionType.OPEN,
};

export function getToolCapabilities(tool: HeroToolType): ToolCapabilities {
    switch (tool) {
        case HeroToolType.AXE:
            return {canCut: true};
        case HeroToolType.PICKAXE:
            return {canMine: true};
        case HeroToolType.HAND:
            return {canPickup: true};
        default:
            return {};
    }
}

function labelFromMeta(obj: THexobject, action: EHexActionType, fallback: string): string {
    const meta: HexobjectMeta = HEXOBJECT_META[obj.hexobjectKey];
    return meta?.actions?.[action]?.label ?? fallback;
}

export function resolveActions(tool: HeroToolType, obj: THexobject): ResolvedAction[] {
    if (!obj.isInteractable) return [];

    if (obj.collision === EHexCollision.OVERLAY) {
        return [
            {
                actioType: "OPEN",
                label: labelFromMeta(obj, EHexActionType.OPEN, 'Open'),
                priority: 100
            },
        ];
    }


    const cap = getToolCapabilities(tool);
    const resolvedActions: ResolvedAction[] = [];

    switch (obj.groupType) {
        case EHexobjectGroup.RESOURCE: {
            if (!obj.resource.isAvailable) break;

            const traits:IResourceTraits = obj.resource.traits ?? {};

            if (cap.canCut && traits.cuttable) {
                resolvedActions.push({
                        actioType: 'CUT',
                        label: labelFromMeta(obj, EHexActionType.CUT, 'Chop'),
                        priority: 90
                    }
                );
            }

            if (cap.canPickup && (traits.pickable)) {
                resolvedActions.push({
                        actioType: 'TAKE',
                        label: labelFromMeta(obj, EHexActionType.TAKE, 'Take'),
                        priority: 80
                    }
                );
            }

            if (cap.canMine && traits.mineable) {
                resolvedActions.push({
                        actioType: "MINE",
                        label: labelFromMeta(obj, EHexActionType.MINE, 'Mine'),
                        priority: 85
                    }
                );
            }

            break;
        }

        case EHexobjectGroup.LOOT: {
            const amount = obj.loot?.amount ?? 0;
            if (amount <= 0) break;
            if (!cap.canPickup) break;
            resolvedActions.push({
                actioType: 'TAKE',
                label: labelFromMeta(obj, EHexActionType.TAKE, 'Take'),
                priority: 90
                }
            );
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
            resolvedActions.push({
                actioType: "OPEN",
                label: labelFromMeta(obj, EHexActionType.OPEN, "Enter"),
                priority: 60,
            });
            break;
        }

        case EHexobjectGroup.TOOL:
        case EHexobjectGroup.WEAPON: {
            if (obj.collision === EHexCollision.TRIGGER && cap.canPickup) {
                resolvedActions.push({
                    actioType: "TAKE",
                    label: labelFromMeta(obj, EHexActionType.TAKE, "Take"),
                    priority: 80,
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