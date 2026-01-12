import {ResolvedActionType} from "@/game-resolvers/interactions-resolver";

export interface IPendingTileAction {
    type: ResolvedActionType;
    startedAt: number;
    endsAt: number;
    hexobjectKey: string;
}