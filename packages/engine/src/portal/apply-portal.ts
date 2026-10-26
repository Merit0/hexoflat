import type { DomainEvent } from '../commands/types';
import type { HexEngineActionContext, HexEngineState } from '../commands/apply-command';
import type { EnterPortalCommand, OpenPortalCommand } from '../commands/hex-engine-commands';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { spendWill, willRejected } from '../knowledge/will';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '../registry/location-key';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import {
  closePortalOnTransition,
  planPortalEntry,
  planPortalOpening,
  resolvePortalSource,
  type LocationTransition,
  type OpenPortalRejection,
} from './portal-rules';
import type { PortalCloseReason, PortalLink } from './portal-state';

interface PortalRemoval {
  locationKey: LocationKey;
  mapId: string | null;
  hex: IHexCoordinates;
}

function openRejected(
  heroId: string,
  target: IHexCoordinates,
  reason: OpenPortalRejection | 'NO_LOCATION',
): DomainEvent {
  return { type: 'PORTAL_OPEN_REJECTED', payload: { heroId, target, reason } };
}

export function applyOpenPortal(
  state: HexEngineState,
  { heroId, target }: OpenPortalCommand['payload'],
  ctx: HexEngineActionContext,
): DomainEvent[] {
  const hero = state.heroes[heroId];
  if (!hero) return [openRejected(heroId, target, 'HERO_NOT_FOUND')];
  if (!state.location) return [openRejected(heroId, target, 'NO_LOCATION')];

  const plan = planPortalOpening(
    state.map,
    hero,
    state.heroes,
    target,
    state.location,
    ctx.worldMap.combatActive,
  );
  if (!plan.ok) return [openRejected(heroId, target, plan.reason)];

  const { inventory } = ctx;
  const scrollKey = HEXOBJECT_KEYS.RETURN_SCROLL;
  const { knowledge } = state;
  const sourcePlan = resolvePortalSource(
    knowledge?.heroId === heroId ? knowledge.skills : undefined,
    inventory.countItem?.(scrollKey) ?? 0,
  );
  if (!sourcePlan.ok) return [openRejected(heroId, target, sourcePlan.reason)];
  const { source, cost } = sourcePlan;
  const ref = `${EHexActionType.USE}:${coordinateKey(target)}`;
  if (cost > 0) {
    if (!knowledge || knowledge.heroId !== heroId) {
      return [
        willRejected(heroId, 'NO_WILL_STATE', ref),
        openRejected(heroId, target, 'NO_WILL_STATE'),
      ];
    }
    if (knowledge.current < cost) {
      return [
        willRejected(heroId, 'INSUFFICIENT_WILL', ref),
        openRejected(heroId, target, 'INSUFFICIENT_WILL'),
      ];
    }
  }
  if (source === 'scroll' && !inventory.takeFromInventory?.(scrollKey, 1).ok) {
    return [openRejected(heroId, target, 'NO_SCROLL')];
  }

  const events: DomainEvent[] = [];
  if (cost > 0 && knowledge) {
    events.push(...spendWill(knowledge, cost, 'action', ref).events);
    knowledge.revision++;
  }

  const tile = state.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(target))!;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, target);
  hero.portal = plan.link;

  events.push({
    type: 'PORTAL_OPENED',
    payload: {
      heroId,
      target: { ...target },
      link: plan.link,
      oneWay: plan.link.campHex === null,
      willSpent: cost,
      source,
    },
  });
  return events;
}

export function applyEnterPortal(
  state: HexEngineState,
  { heroId }: EnterPortalCommand['payload'],
  ctx: HexEngineActionContext,
): DomainEvent[] {
  const reject = (reason: string): DomainEvent[] => [
    { type: 'PORTAL_ENTER_REJECTED', payload: { heroId, reason } },
  ];
  const hero = state.heroes[heroId];
  if (!hero) return reject('HERO_NOT_FOUND');
  if (!state.location) return reject('NO_LOCATION');

  const plan = planPortalEntry(state.map, hero, state.location, ctx.worldMap.combatActive);
  if (!plan.ok) return reject(plan.reason);

  const { destination } = plan;
  const events: DomainEvent[] = [
    {
      type: 'PORTAL_ENTERED',
      payload: {
        heroId,
        from: state.location.locationKey,
        to: destination.locationKey,
        toMapId: destination.mapId,
        arrivalNear: destination.arrivalNear,
        portalHex: plan.portalHex,
      },
    },
  ];
  if (destination.closesPair) {
    events.push(closeEvent(heroId, 'RETURNED', hero.portal!));
    hero.portal = null;
  }
  return events;
}

export function closePortalIfOpen(
  state: HexEngineState,
  heroId: string,
  transition: LocationTransition,
): DomainEvent[] {
  const hero = state.heroes[heroId];
  if (!hero) return [];
  const result = closePortalOnTransition(hero, transition);
  if (!result.closes) return [];
  hero.portal = null;
  return [closeEvent(heroId, result.reason, result.link)];
}

export function closeEvent(
  heroId: string,
  reason: PortalCloseReason,
  link: PortalLink,
): DomainEvent {
  const remove: PortalRemoval[] = [
    { locationKey: link.originLocationKey, mapId: link.originMapId, hex: link.originHex },
  ];
  if (link.campHex) remove.push({ locationKey: 'camping', mapId: null, hex: link.campHex });
  return { type: 'PORTAL_CLOSED', payload: { heroId, reason, remove } };
}
