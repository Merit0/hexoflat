import type { ContainerTokenSource } from '../containers/create-container';
import type { BattleState } from './battle-state';

export function graveTokenSource(
  state: Pick<BattleState, 'id' | 'seed' | 'tokenSecret'>,
): ContainerTokenSource {
  const secret = state.tokenSecret;
  if (!secret) return { seed: state.seed, scope: [state.id] };
  return { seed: secret.seed, scope: [secret.mapId, state.id] };
}
