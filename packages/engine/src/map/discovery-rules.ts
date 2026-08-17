import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { promoteDiscovery } from './discovery-state';
import type HexMapModel from './models/hex-map-model';
import type { HexTileModel } from './models/hex-tile-model';
import type { IHexCoordinates } from './interfaces/hex-tile-config-interface';
import type { DomainEvent } from '../commands/types';

/**
 * The v0.1 reveal rule (design §9, §35.3): after each executed movement step,
 * the entered hex becomes `DISCOVERED` and its generated neighbours become
 * `OBSERVED`.
 *
 * This is deliberately **not** `fog-service.revealAroundHero`, which reveals
 * the hero's hex and all six neighbours identically and fully. That function
 * is untouched and still runs the existing world maps exactly as before; the
 * difference between "I have been here" and "I can see something over there"
 * is the whole of the organic frontier, and it only exists under
 * `FEATURE_EXPLORATION_SLICE`.
 */

/**
 * What an `OBSERVED` hex tells the player: a category, never an identity.
 *
 * Observing must not leak content. "A stone barrier", "something green" is
 * the promise; `hexobject.hexobjectKey` is the leak, and invariant I3 is the
 * rule being kept. So the category is derived from the coarsest facts about
 * what sits there — does it block, is it alive, is it a structure — and the
 * key itself never enters an event payload.
 */
export type ObservedCategory = 'OPEN_GROUND' | 'OBSTACLE' | 'GROWTH' | 'STRUCTURE' | 'PRESENCE';

export function categorizeForObservation(tile: HexTileModel): ObservedCategory {
  const hexobject = tile.hexobject;
  if (!hexobject) return 'OPEN_GROUND';

  switch (hexobject.groupType) {
    case EHexobjectGroup.CREATURE:
      return 'PRESENCE';
    case EHexobjectGroup.RESOURCE:
      return 'GROWTH';
    case EHexobjectGroup.CONSTRUCTION:
      return 'STRUCTURE';
    default:
      return hexobject.collision === EHexCollision.SOLID ? 'OBSTACLE' : 'OPEN_GROUND';
  }
}

export interface HexDiscoveredEvent extends DomainEvent {
  type: 'HEX_DISCOVERED';
  payload: { coordinates: IHexCoordinates };
}

export interface HexObservedEvent extends DomainEvent {
  type: 'HEX_OBSERVED';
  payload: { coordinates: IHexCoordinates; category: ObservedCategory };
}

export type DiscoveryEvent = HexDiscoveredEvent | HexObservedEvent;

/**
 * Applies the reveal rule for one entered hex and reports only what actually
 * changed.
 *
 * Silence on a no-op is load-bearing, not an optimisation: E0's idempotency
 * guarantees that replaying a `commandId` produces the original events and no
 * second effect, and a rule that re-emitted `HEX_DISCOVERED` every time the
 * hero re-crossed a known hex would make the event stream a poor witness to
 * that. Promotion (never assignment) is what keeps I10 true — walking back
 * past the Camp does not demote it out of `UNDERSTOOD`.
 */
export function applyStepDiscovery(map: HexMapModel, entered: IHexCoordinates): DiscoveryEvent[] {
  const events: DiscoveryEvent[] = [];
  const enteredTile = map.getTileAt(entered);
  if (!enteredTile) return events;

  const discovered = promoteDiscovery(enteredTile.discovery, 'DISCOVERED');
  if (discovered !== enteredTile.discovery) {
    enteredTile.discovery = discovered;
    events.push({ type: 'HEX_DISCOVERED', payload: { coordinates: enteredTile.coordinates } });
  }

  const enteredKey = coordinateKey(enteredTile.coordinates);
  for (const neighbor of getOddQNeighbors(entered)) {
    if (coordinateKey(neighbor) === enteredKey) continue;

    // A neighbour outside the technical grid was never generated, so there is
    // nothing to observe — this is what makes the frontier stop organically
    // instead of at the edge of the array.
    const tile = map.getTileAt(neighbor);
    if (!tile) continue;

    const observed = promoteDiscovery(tile.discovery, 'OBSERVED');
    if (observed === tile.discovery) continue;

    tile.discovery = observed;
    events.push({
      type: 'HEX_OBSERVED',
      payload: { coordinates: tile.coordinates, category: categorizeForObservation(tile) },
    });
  }

  return events;
}

/**
 * The rule across a whole executed path, in step order.
 *
 * `path` is `HERO_MOVED`'s own path, hero's starting hex first. That first
 * hex is walked too rather than skipped: the hero is standing on it, and
 * whichever state it is already in, promotion makes re-applying it a no-op.
 */
export function applyPathDiscovery(map: HexMapModel, path: IHexCoordinates[]): DiscoveryEvent[] {
  return path.flatMap((coordinates) => applyStepDiscovery(map, coordinates));
}
