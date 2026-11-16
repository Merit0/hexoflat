import type { THexobject } from '../abstraction/hexobject-abstraction';
import { getMeta } from '../content/content-accessors';
import type { ActionDestination } from '../content/content-schema';
import type { THeroToolKey } from '../content/equipment.content';
import { EHexActionType } from '../enums/hex-action-type';
import { resolveActions } from '../game-resolvers/interactions-resolver';
import type { IHexCoordinates } from './interfaces/hex-tile-config-interface';
import type { HexTileModel } from './models/hex-tile-model';
import { hexDistance } from '../utils/hex-utils';

export function objectActionDestination(
  object: THexobject | null | undefined,
  action: EHexActionType,
): ActionDestination | null {
  if (!object) return null;
  const meta = getMeta(object.hexobjectKey);
  const destination = meta.actions?.[action]?.destination;
  return destination ?? (action === EHexActionType.ENTER ? (meta.enter ?? null) : null);
}

export function objectDestinationAction(
  object: THexobject | null | undefined,
  type: ActionDestination['type'],
): EHexActionType | null {
  return (
    Object.values(EHexActionType).find(
      (action) => objectActionDestination(object, action)?.type === type,
    ) ?? null
  );
}

export type TransitionRefusal =
  'NO_POSITION' | 'BATTLE_OPEN' | 'HIDDEN' | 'TOO_FAR' | 'INVALID_ACTION';

export const TRANSITION_REFUSAL_MESSAGES: Record<TransitionRefusal, string> = {
  NO_POSITION: 'No hero here.',
  BATTLE_OPEN: 'Cannot leave the map during combat!',
  HIDDEN: 'You cannot see it yet.',
  TOO_FAR: 'Stand next to it first.',
  INVALID_ACTION: 'This cannot be done here.',
};

export function objectTransitionRefusal(
  tile: HexTileModel,
  hero: IHexCoordinates | null,
  combatActive: boolean,
  action: EHexActionType,
  tool: THeroToolKey,
  allowStandingOnTarget = false,
): TransitionRefusal | null {
  if (!hero) return 'NO_POSITION';
  if (combatActive) return 'BATTLE_OPEN';
  if (!tile.isRevealed) return 'HIDDEN';
  const distance = hexDistance(hero, tile.coordinates);
  if (distance > 1 || (!allowStandingOnTarget && distance === 0)) return 'TOO_FAR';
  if (!tile.hexobject || !objectActionDestination(tile.hexobject, action)) return 'INVALID_ACTION';
  return resolveActions(tool, tile.hexobject).some(
    (candidate) => String(candidate.actioType) === String(action),
  )
    ? null
    : 'INVALID_ACTION';
}
