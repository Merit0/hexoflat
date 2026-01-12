import {EHexActionType} from "@/enums/hex-action-type";

export interface IPendingTileAction {
    type: EHexActionType;
    startedAt: number;
    endsAt: number;
    hexobjectKey: string;

    meta?: Record<string, any>;
}