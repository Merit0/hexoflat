export type GameEventType =
    | 'INFO'
    | 'ACTION'
    | 'LOOT'
    | 'BATTLE'
    | 'MAP'
    | 'NAVIGATION';

export interface GameEventLogItem {
    id: string;
    message: string;
    type: GameEventType;
    createdAt: number;
    actor: string;
}