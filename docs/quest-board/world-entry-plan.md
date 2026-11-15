# Treasure Seeker: world entry

Requested behavior (2026-11-15): accepting an expedition at the camp board places it in My Quests and creates a treasure-map hex on an empty, reachable Silesia tile. The marker follows normal fog of war. The hero must stand next to it and use the hand's OPEN action to enter the quest field. The field has an adjacent camping door, which pauses the run and returns to camp. Reopening the same entrance resumes the stored field. Quest mode retains Hero, Inventory, Quest, Events tabs, replacing Path with Quest.

## Implementation [DONE — 2026-11-15]

- Engine: `quests/world-entrances.ts` places/removes quest-linked map objects and validates revealed, adjacent entry. `questId` survives map serialization. `QUEST_PAUSE` preserves the server-held run; `QUEST_ENTER` resumes a suspended run without regenerating its seed or charging acceptance again.
- API: acceptance/abandonment reconcile Silesia in the same transaction, with expedition locking before aggregate locking. Travel/ensure also reconcile existing maps. `QuestRunService` validates the entrance against the stored world rather than trusting client coordinates. Suspended runs are hidden from the active quest projection and permit ordinary world commands.
- Web: board buttons accept only; the Silesia hand OPEN enters. Quest mode uses the normal hero panel with the Quest tab. A camping-door tool action pauses; completion/abandonment returns to camp. Loot pickup leaves the Quest tab selected. The ordinary world tool overlay is hidden during quest mode.
- Tests: engine entrance/fog/persistence/access/pause-resume tests, updated real-Postgres run and secret-projection fixtures, `quest-world-entry.spec.ts` for acceptance -> walk -> OPEN -> four tabs -> camping portal -> re-entry. Existing loot specs enter through the new world flow; their Will fixture isolates quest prices from the Silesia walk cost.

## Validation

- Engine: full suite passed (1619 tests, 2 skipped), followed by a passing four-case entrance suite including the newly added fully-explored-world check.
- Frontend: full suite passed, 3292 tests.
- API: 21 real-Postgres quest/secret-projection tests passed, including pause/abandon cleanup.
- Browser: six Chromium scenarios passed without retries across the final runs: world entry / pause / re-entry; full loot collection / return / next card; reload persistence; hand-only object use; clean quest completion; Will exhaustion / return to camp.
- Typecheck passed across all packages; engine/frontend build passed through the E2E runner. Lint passed for changed TypeScript/Vue files with the existing reviewed cycle warning on `hex-world-map.vue`; `git diff --check` passed.
- No commit or push performed.
