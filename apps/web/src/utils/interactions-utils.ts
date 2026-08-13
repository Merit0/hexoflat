import { ResolvedAction } from '@hexoflat/engine/game-resolvers/interactions-resolver';

export function getTopAction(actions: ResolvedAction[]): ResolvedAction | null {
  if (!actions.length) return null;
  return actions.slice().sort((a, b) => b.priority - a.priority)[0];
}
