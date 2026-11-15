# Map objects and destination transitions

Date: 2026-11-15. Branch: `codex/map-object-transitions`.

## Scope and baseline

Preserve the staged Treasure Seeker world-entry implementation. This phase adds
shared map placement and action destinations without merging world, quest, or
battle documents or replacing their command endpoints. No commit is authorized.

Before changing the interaction paths, existing travel, squad, and quest entrance
characterizations passed (19 tests). The initial UI setup was interrupted by a
transient TypeScript error in a concurrently written placement test; the corrected
suite was subsequently run. No successful pre-refactor UI baseline is claimed.

## Observed flows and chosen contracts

| Flow                | Authoritative handler        | Lifecycle preserved                                    |
| ------------------- | ---------------------------- | ------------------------------------------------------ |
| Cave ENTER          | WORLD_TRAVEL / travelWorld   | content price, sealing, arrival, dungeon departure     |
| Enemy ATTACK        | world action / requestBattle | engagement before battle, ambush, victory/defeat       |
| Treasure Map OPEN   | QUEST_ENTER                  | accepted association, generation, suspended-run resume |
| Return portal ENTER | existing portal command      | return-link rules and costs                            |

`actions[action].destination` describes WORLD, QUEST, BATTLE, or PORTAL intent.
`objectActionDestination` also reads legacy `enter` content, keeping existing
content compatible. Object categories remain unchanged. World and quest handlers
use the same voluntary-entry validation; battle action validation runs before
charging, while watcher ambushes retain their separate rules.

World gates retain their historical distance <= 1 policy. Quest and squad actions
require distance exactly 1. New deliberate fixes reject hidden world gates and
hidden/wrong-tool squad attacks without charging Will.

`planObjectPlacement` selects eligible empty positions or validates an explicit
expected-object replacement. `placeMapObject` applies the plan within the caller's
transaction. Terrain, hero occupancy, exits, spawners, and pending actions are
protected. Selection is seeded and independent of fog and tile-array order.

Quest content owns `mapObjectPlacement` (target map, object key, strategy).
Reconciliation creates configured worlds as necessary and preserves existing
tokens and fog. An alternate Silesia North configuration is covered by tests.
If no eligible space exists, reconciliation preserves the map and retries later;
acceptance remains successful, matching the existing behavior. The placement
planner explicitly reports `NO_ELIGIBLE_HEX`; it never silently replaces objects.

The frontend dispatches destinations through the common hex-action controller.
Pending requests are guarded per hero/map. Quest transport checks session epoch
and current context before dispatch and before applying responses, including
replay restoration. The dedicated `/world/treasure-seeker-map` URL identifies the
experience; the server quest projection identifies the saved run.

## Verification

| Acceptance area                                                                     | Evidence                                                  |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Empty placement, explicit replacement, no space, reserved tiles                     | object-placement.test.ts                                  |
| Stable seeded placement, fog, revealed map, persistence, abandonment, alternate map | world-entrances.test.ts                                   |
| Destination descriptors and invalid interactions                                    | object-transition.test.ts, travel.test.ts, squads.test.ts |
| Duplicate actions, failed transport retry, stale context                            | object-transition-controller.test.ts                      |
| Stale response cannot install a run/inventory/loot effects                          | quest-loot.test.ts                                        |
| Active quest URL, reload, inactive URL fallback                                     | use-quest-map-route.test.ts                               |
| Quest/server lifecycle and world regressions                                        | real PostgreSQL integration tests                         |
| Three consecutive portal/re-entry cycles with active and suspended reloads          | quest-world-entry.spec.ts                                 |
| Cave entry/return and prices                                                        | will-economy.spec.ts                                      |
| Enemy ATTACK, battle reload, victory return                                         | squad-actions.spec.ts                                     |

## Final verification [DONE — 2026-11-15]

- Engine: `cd packages/engine && ./node_modules/.bin/vitest run` — **1,637 passed,
  2 existing skips**.
- Web: `cd apps/web && ./node_modules/.bin/vitest run` — **3,304 passed**.
- API: `cd apps/api && ./node_modules/.bin/vitest run
src/quests/quest-run.integration.spec.ts src/player/container-secrets.integration.spec.ts
src/world/world.integration.spec.ts` — **63 passed against real PostgreSQL**.
- Workspace typecheck, engine build, and hooks-enabled web build passed through
  the E2E runner. Changed TypeScript/Vue lint passed with two existing cycle
  warnings (router and world scene); no threshold changes or new cycle exemptions.
- `git diff --check` passed.

Seven distinct Chromium scenarios passed across targeted runs, with automatic
retries disabled: three consecutive quest portal/re-entry cycles; cave gate
entry/return and Will costs; enemy hand ATTACK and battle reload; cave battle
victory/return without renderer errors; clean quest completion; stranded return;
give-up. The portal scenario includes real walking, both active/suspended reloads,
stable token placement, the quest URL, and the four right-panel tabs.

The clean completion scenario initially exceeded its inherited 60-second timeout
while running alongside the stress scenarios. Its timeout is now 120 seconds;
it subsequently passed with one worker, including a final fresh-build run in
39.7 seconds. This is a test harness adjustment, not a gameplay change.

Run the UI checks through `sh scripts/pre-push-e2e.sh <spec> --project=chromium
--retries=0`. Specs: `e2e/hero/quest-world-entry.spec.ts`,
`e2e/camp/will-economy.spec.ts` (Entering the cave),
`e2e/combat/squad-actions.spec.ts` (hand ATTACK and cave victory), and
`e2e/hero/quest-seeker.spec.ts` (clean run, running out of Will, giving up).
Final completion command: `sh scripts/pre-push-e2e.sh e2e/hero/quest-seeker.spec.ts
--grep 'clean run reaches' --project=chromium --workers=1 --retries=0`.

Acceptance criteria 1–16 are covered by these UI, engine, and database checks.
The no-space behavior is the explicit limitation described above; successful
acceptance cannot guarantee immediate placement when no eligible position exists.

## Review

Independent review identified an action-only WORLD descriptor compatibility gap
and stale quest projection application. Both were fixed and regression-tested.
The review also identified late transport failures affecting a newer session;
the catch path now checks context before marking the session offline, with a
delayed-rejection regression test.
Quest association hydration now discovers the quest destination action instead of
assuming OPEN. Numbered-trail gameplay and the construction/creature categories
remain unchanged.
