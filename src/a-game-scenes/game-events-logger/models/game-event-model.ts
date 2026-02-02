export type GameEventType =
    | "INFO"
    | "ACTION"
    | "LOOT"
    | "BATTLE"
    | "MAP";

export interface GameEventLogItem {
    id: string;
    message: string;
    type: GameEventType;
    createdAt: number;
    actor: string;
}