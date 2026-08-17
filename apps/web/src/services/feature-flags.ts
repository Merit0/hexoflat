import { isExplorationSliceEnabled } from '@hexoflat/engine';

/**
 * The web client's answer to "is the exploration slice on?".
 *
 * This resolves the *inputs* only — the env var, and whether this client is
 * joined to a server scenario room. Whether those inputs add up to "on" is
 * the engine's call (`features/feature-flags.ts`), so the client and the
 * authoritative server cannot drift apart on it.
 *
 * `apps/web` has no socket client today: multiplayer is a server-side gateway
 * that nothing here connects to, so `isMultiplayerSession` is false and the
 * env var decides. When a client does join a room, set that flag from the
 * connection rather than reintroducing a second copy of the rule here.
 */
export function isMultiplayerSession(): boolean {
  return false;
}

export function explorationSliceEnabled(): boolean {
  return isExplorationSliceEnabled({
    // Statically replaced by Vite, so a build without it folds this to false
    // and tree-shakes whatever it guards.
    explorationSliceRequested: import.meta.env.VITE_FEATURE_EXPLORATION_SLICE === 'true',
    isMultiplayerSession: isMultiplayerSession(),
  });
}
