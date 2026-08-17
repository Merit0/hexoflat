/**
 * Feature flags whose answer is a *rule*, not a preference.
 *
 * The resolution lives in the engine rather than in each app because the one
 * thing that matters about `FEATURE_EXPLORATION_SLICE` — that it is off in a
 * multiplayer session — has to hold identically on the client and on the
 * authoritative server. A constant read straight from an env var in
 * `apps/web` and a separate check in `apps/api` would be two chances to
 * disagree; a pure function tested once is not.
 */

export const FEATURE_EXPLORATION_SLICE = 'FEATURE_EXPLORATION_SLICE' as const;

export interface SessionFeatureContext {
  /** What the build/config asked for — an env var, a settings toggle, a test. */
  explorationSliceRequested: boolean;
  /**
   * Whether this session is authoritative-multiplayer: a server scenario room,
   * or a client joined to one. Not "could be multiplayer some day".
   */
  isMultiplayerSession: boolean;
}

/**
 * Whether the exploration slice's rules are live for this session.
 *
 * Hard invariant: **never in multiplayer**, whatever the config says. The
 * slice is designed single-player (docs/EXPLORATION-SLICE-WORKFLOW.md §3.6) —
 * its commands carry `actorId`/`commandId` so co-op can be sewn on later, but
 * the rules themselves have not been scoped for concurrent actors, and a
 * half-enabled slice in a shared room desynchronises peers rather than
 * degrading gracefully. Multiplayer wins over the request, not the other way
 * round, so a stray env var in a server build cannot switch it on.
 */
export function isExplorationSliceEnabled(context: SessionFeatureContext): boolean {
  if (context.isMultiplayerSession) return false;

  return context.explorationSliceRequested;
}
