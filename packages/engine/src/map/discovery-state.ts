/**
 * How much the player knows about a hex.
 *
 * Replaces the single `isRevealed` boolean with the four states the
 * exploration design needs (design v0.1 §9). `isRevealed` is *not* deleted —
 * it survives as a derived getter/setter on `HexTileModel` for the whole
 * slice, so the 30+ existing call sites (pathfinding, combat, the renderer,
 * saves) keep working untouched. Removing it is a clean-up after the Stop
 * Gate, not part of the slice (workflow §3.2).
 *
 * What each state means for the player:
 * - `UNKNOWN`      — not rendered at all, not targetable, content not
 *                    instantiated into anything player-facing;
 * - `OBSERVED`     — rough existence and *category* known ("a stone barrier",
 *                    "something green"), never the exact content key;
 * - `DISCOVERED`   — the hero has physically been there; terrain is known and
 *                    pathfinding may use it;
 * - `UNDERSTOOD`   — the player knows what the place *means* (Camp, a mastered
 *                    resource source, a landmark after Insight).
 */
export type DiscoveryState = 'UNKNOWN' | 'OBSERVED' | 'DISCOVERED' | 'UNDERSTOOD';

export const DISCOVERY_STATES = ['UNKNOWN', 'OBSERVED', 'DISCOVERED', 'UNDERSTOOD'] as const;

/**
 * Knowledge is a ladder, not a set of flags: every state strictly contains
 * what the one below it tells the player. Invariant I10 (knowledge
 * monotonicity) is exactly the statement that nothing walks back down it.
 */
const DISCOVERY_RANK: Record<DiscoveryState, number> = {
  UNKNOWN: 0,
  OBSERVED: 1,
  DISCOVERED: 2,
  UNDERSTOOD: 3,
};

export function discoveryRank(state: DiscoveryState): number {
  return DISCOVERY_RANK[state];
}

/** True when `next` would tell the player *less* than `current` already does. */
export function isDiscoveryDowngrade(current: DiscoveryState, next: DiscoveryState): boolean {
  return DISCOVERY_RANK[next] < DISCOVERY_RANK[current];
}

/**
 * The higher of the two states. Reveal rules call this instead of assigning
 * directly, so observing a hex the hero has already stood on cannot demote it
 * back to `OBSERVED`.
 */
export function promoteDiscovery(current: DiscoveryState, next: DiscoveryState): DiscoveryState {
  return isDiscoveryDowngrade(current, next) ? current : next;
}
