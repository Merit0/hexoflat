import type { DomainEvent } from '../commands/types';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { EHexActionType } from '../enums/hex-action-type';
import type { SquadLifecycleCommand } from '../battle/battle-commands';
import { assertNever } from '../utils/assert-never';
import { asSquad, watchingSquad } from './squad-state';
import {
  attackSquad,
  refuse,
  requestBattle,
  scoutSquad,
  type Outcome,
  type SquadWorld,
} from './squad-actions';
import { beginBattle, closeBattle } from './squad-battle';

const SQUAD_ACTIONS = new Set<EHexActionType>([EHexActionType.ATTACK, EHexActionType.SCOUT]);

export function isSquadAction(actionType: EHexActionType): boolean {
  return SQUAD_ACTIONS.has(actionType);
}

export type SquadStart =
  | { ok: true; endsAt: number; events: DomainEvent[] }
  | { ok: false; message: string; reason: string };

export function startSquadAction(
  world: SquadWorld,
  tile: HexTileModel,
  input: { heroId: string; actionType: EHexActionType; now: number },
): SquadStart {
  const squad = asSquad(tile.hexobject);
  const outcome = squad
    ? runSquadAction(world, input.actionType, { ...input, atMs: input.now, squadId: squad.id })
    : refuse('UNKNOWN_SQUAD');
  if (!outcome.ok) return { ok: false, message: outcome.reason, reason: outcome.reason };
  return { ok: true, endsAt: input.now, events: outcome.events };
}

function runSquadAction(
  world: SquadWorld,
  actionType: EHexActionType,
  input: { heroId: string; atMs: number; squadId: string },
): Outcome {
  if (actionType === EHexActionType.SCOUT) return scoutSquad(world, input);
  return attackSquad(world, input);
}

function performLifecycle(world: SquadWorld, command: SquadLifecycleCommand): Outcome {
  const { payload } = command;
  switch (payload.kind) {
    case 'start':
      return beginBattle(world, payload.heroes);
    case 'close':
      return closeBattle(world);
    default:
      return assertNever(payload);
  }
}

export function applySquadLifecycle(
  world: SquadWorld,
  command: SquadLifecycleCommand,
): DomainEvent[] {
  const outcome = performLifecycle(world, command);
  if (outcome.ok) return outcome.events;
  return [
    {
      type: 'SQUAD_REJECTED',
      payload: {
        heroId: command.payload.heroId,
        action: command.payload.kind,
        reason: outcome.reason,
      },
    },
  ];
}

export function ambushStop(world: SquadWorld, path: IHexCoordinates[]): number {
  if (world.battle || world.engagement) return -1;
  return path.findIndex((coord, index) => index > 0 && !!watchingSquad(world.map, coord));
}

export function ambushAt(world: SquadWorld, heroId: string): DomainEvent[] {
  const hero = world.heroes[heroId];
  const watcher = hero ? watchingSquad(world.map, hero.coordinates) : null;
  return hero && watcher ? requestBattle(world, watcher, hero, true) : [];
}
