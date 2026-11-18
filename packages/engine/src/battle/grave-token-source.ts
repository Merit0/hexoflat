import type { ContainerTokenSource } from '../containers/create-container';
import type { LootRollSource } from '../loot/roll-for';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import type { BattleState } from './battle-state';

type GraveSecretState = Pick<BattleState, 'id' | 'tokenSecret'>;

export function graveTokenSource(state: GraveSecretState): ContainerTokenSource {
  return { seed: state.tokenSecret.seed, scope: [state.tokenSecret.mapId, state.id] };
}

export function graveLootSource(state: GraveSecretState, targetKey: string): LootRollSource {
  return {
    seed: state.tokenSecret.seed,
    sourceId: tokenSourceIdOf('grave', state.tokenSecret.mapId, state.id),
    targetKey,
  };
}
