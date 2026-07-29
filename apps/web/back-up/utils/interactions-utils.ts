import {ResolvedAction} from "@/game-resolvers/interactions-resolver";

/**
 * Повертає найпріоритетнішу дію для UI-підказки
 * (chip / hint над тайлом).
 *
 * Якщо дій нема — повертає null.
 */
export function getTopAction(actions: ResolvedAction[]): ResolvedAction | null {
    if (!actions.length) return null;
    return actions.slice().sort((a, b) => b.priority - a.priority)[0];
}