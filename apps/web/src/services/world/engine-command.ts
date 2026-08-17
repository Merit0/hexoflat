/**
 * The command envelope fields this client stamps on every engine command.
 *
 * Shared by the stores that dispatch, rather than defined in one of them, so
 * that `actorId` cannot drift between call sites — which is exactly how it
 * broke once already: `hero-store` sent the *hero's* id, which is `''` on a
 * freshly constructed `HeroModel`, and the schema's `min(1)` turned every
 * free-roam move into a thrown ZodError.
 */

/**
 * Who is issuing commands from this client — the local session, not the hero.
 * A hero id is *what is being moved*; the actor is *who asked*, and in
 * drop-in/drop-out co-op those genuinely differ. The slice is single-player
 * (docs/EXPLORATION-SLICE-WORKFLOW.md §3.6), so there is one actor here; the
 * server does not trust this field anyway and overwrites it with the
 * authenticated user.
 */
export const LOCAL_ACTOR_ID = 'local-player';

/** Unique per intent. A retry would reuse one — nothing in local play retries yet. */
export function newCommandId(): string {
  return crypto.randomUUID();
}
