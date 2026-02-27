import {EHexActionType} from "@/enums/hex-action-type";
import {HeroToolType} from "@/enums/hero-tool-type";
import {LocationKey} from "@/registry/world-map-registry";

export interface IHexobjectMeta {
    key: string;

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
    yields?: {
        wood?: number;
        coins?: number;
        stone?: number;
    };

    enter?: {
        type: "WORLD";
        locationKey: LocationKey;
    };

    route?: {
        name: string;
        build?: (key: string) => {
            params?: Record<string, any>;
            query?: Record<string, any>;
        };
    };
}