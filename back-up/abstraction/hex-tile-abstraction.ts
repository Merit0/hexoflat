import {EHexActionType} from "@/enums/hex-action-type";
import {THexobjectKey} from "@/registry/hexobjects-registry";

export interface IPendingTileAction {
    type: EHexActionType;
    startedAt: number;
    endsAt: number;
    hexobjectKey: THexobjectKey;

    cancelled?: boolean;
    cancelReason?: "ESC" | "HIDE" | "MOVE";

    meta?: Record<string, any>;
}