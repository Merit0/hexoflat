import type { DomainEvent } from './types';

/**
 * What a command did, kept so that seeing the same `commandId` again can
 * answer from memory instead of doing it a second time.
 */
export interface AppliedCommandEntry {
  commandId: string;
  /** The state version this command produced. */
  stateVersion: number;
  /** Replayed verbatim to a duplicate, so a retry sees the original outcome. */
  events: DomainEvent[];
}

/**
 * How many commands are remembered.
 *
 * The log is part of the snapshot, so it cannot grow without bound — a long
 * session would bloat every autosave with events nobody will ever ask about
 * again. A few hundred covers what idempotency is actually for: a client
 * retrying after a dropped socket, or a peer replaying the tail of a session.
 * A duplicate older than that is not a retry, it is a bug somewhere else.
 */
export const APPLIED_COMMAND_LOG_LIMIT = 256;

/** Kept as an array rather than a keyed record so the eviction order is the payload's own order. */
export type AppliedCommandLog = AppliedCommandEntry[];

export function findAppliedCommand(
  log: AppliedCommandLog,
  commandId: string,
): AppliedCommandEntry | null {
  // Newest first: a retry is almost always of something recent, and the log
  // is capped, so this stays a bounded scan rather than a growing one.
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].commandId === commandId) return log[i];
  }

  return null;
}

/** Appends in place, evicting the oldest entries once the cap is reached. */
export function recordAppliedCommand(
  log: AppliedCommandLog,
  entry: AppliedCommandEntry,
  limit: number = APPLIED_COMMAND_LOG_LIMIT,
): void {
  log.push(entry);

  if (log.length > limit) {
    log.splice(0, log.length - limit);
  }
}
