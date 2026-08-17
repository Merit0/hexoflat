import { isExplorationSliceEnabled, type SessionFeatureContext } from '@hexoflat/engine';

/**
 * Feature-flag inputs for a server-side scenario room.
 *
 * Every room the gateway owns is an authoritative multiplayer session by
 * construction — that is what a room *is* here, whether one client or four
 * are currently attached. A room that started single and gained a second
 * player must not change its rules mid-session, so this does not count
 * clients.
 *
 * The consequence, checked by tests rather than left to convention: the
 * exploration slice is never on server-side, no matter what the environment
 * says (docs/EXPLORATION-SLICE-WORKFLOW.md §3.6).
 */
export function scenarioRoomFeatureContext(): SessionFeatureContext {
  return {
    explorationSliceRequested: process.env.FEATURE_EXPLORATION_SLICE === 'true',
    isMultiplayerSession: true,
  };
}

export function isExplorationSliceEnabledForScenarioRoom(): boolean {
  return isExplorationSliceEnabled(scenarioRoomFeatureContext());
}
