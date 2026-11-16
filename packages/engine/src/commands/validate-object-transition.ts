import {
  TRANSITION_REFUSAL_MESSAGES,
  objectActionDestination,
  objectTransitionRefusal,
} from '../map/object-transition';
import { EHexActionType } from '../enums/hex-action-type';
import type { THeroToolKey } from '../content/equipment.content';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { isSquadAction } from '../squads/apply-squad';
import type { HexEngineState } from './apply-command';
import type { StartHexActionCommand } from './hex-engine-commands';
import type { DomainEvent } from './types';

export function transitionRejection(
  state: HexEngineState,
  tile: HexTileModel,
  input: StartHexActionCommand['payload'],
): DomainEvent[] | null {
  const { coordinates, actionType, toolKey, heroId } = input;
  if (!objectActionDestination(tile.hexobject, actionType)) return null;
  const blocked = objectTransitionRefusal(
    tile,
    state.heroes[heroId]?.coordinates ?? null,
    !!(state.battle || state.engagement),
    actionType,
    toolKey as THeroToolKey,
    actionType === EHexActionType.ENTER,
  );
  if (!blocked) return null;
  const reasons = { TOO_FAR: 'NOT_ADJACENT', NO_POSITION: 'NO_HERO', BATTLE_OPEN: 'BATTLE_OPEN' };
  const reason = reasons[blocked as keyof typeof reasons];
  if (isSquadAction(actionType) && reason)
    return [
      {
        type: 'SQUAD_REJECTED',
        payload: { heroId, action: actionType, reason },
      },
    ];
  return [
    {
      type: 'HEX_ACTION_START_REJECTED',
      payload: { coordinates, actionType, message: TRANSITION_REFUSAL_MESSAGES[blocked] },
    },
  ];
}
