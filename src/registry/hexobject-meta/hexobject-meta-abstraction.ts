import {EHexActionType} from "@/enums/hex-action-type";
import {HeroToolType} from "@/enums/hero-tool-type";
import {LocationKey} from "@/registry/world-map-registry";
import {THexobjectKey} from "@/registry/hexobjects-registry";

export type THexYieldKey = "wood" | "coins" | "stone";
export type THexYields = Partial<Record<THexYieldKey, number>> & {
    [key: string]: number | undefined;
};

export interface IHexobjectMeta {
    key: THexobjectKey;

    // UI
    title: string;
    subtitle?: string;

    // allowed actions
    actions?: Partial<Record<EHexActionType, {
        label: string;
        durationMs?: number;
        requiredTool?: HeroToolType;
        durabilityCostPct?: number;
    }>>;

    // rewards
    yields?: THexYields;

    enter?: {
        type: "WORLD";
        locationKey: LocationKey;
    };

    route?: {
        name: string;
        build?: (key: string) => {
            params?: Record<string, unknown>;
            query?: Record<string, unknown>;
        };
    };
}