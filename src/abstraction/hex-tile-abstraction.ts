import {EHexActionType} from "@/enums/hex-action-type";
import {THexobjectKey} from "@/registry/hexobjects-registry";

export interface IPendingTileAction {
    type: EHexActionType;
    startedAt: number;
    endsAt: number;
    hexobjectKey: THexobjectKey;

    meta?: Record<string, any>;
}