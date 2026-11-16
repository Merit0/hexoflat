# Active gameplay map refactor [DONE — 2026-11-15]

Approved scope: remove quest ownership from generic hex objects, generate the Seeker board through the shared pipeline, and mount one gameplay renderer at a time. Work stays on `codex/map-object-transitions`.

| Concern                  | Before                                      | After                                                                                                                       |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Quest entrance ownership | `IBaseHexobject.questId`                    | Quest-owned `ServerWorld.questEntrances`, mapping quest IDs to stable object IDs                                            |
| Saved entrances          | Object-specific hydration                   | Legacy bindings migrated before generic hydration; IDs survive reload                                                       |
| Seeker geometry          | Frontend floor/border construction          | Registered `treasure-seeker-map` recipe runs through `runBoardPipeline`; server projects floor, border, exit and background |
| Mounted boards           | World canvas kept beneath quest/battle      | `gameplay-board-host.vue` mounts exactly one world, quest or battle renderer                                                |
| Shared UI                | Scene mixed world rendering with session UI | Persistent shell owns panel/session; `world-map-board.vue` owns world canvas and effects                                    |
| Tool origin and hover    | World/quest branches in consumers           | `useActiveMapContext` supplies active hero position and object lookup; one world/quest tooltip                              |
| World simulation         | Loading a world could start a hidden loop   | Active board owns loop startup; non-world modes stop it                                                                     |

## Completed checklist

- [x] Characterize seeded Seeker geometry before switching generation.
- [x] Remove `questId` from the base object contract and migrate existing saved entrances.
- [x] Preserve placement, fog, costs, command validation and stable entrance association.
- [x] Register Seeker generation with the common board pipeline and consume its projection in the frontend.
- [x] Extract world rendering and use mutually exclusive board mounting.
- [x] Clear stale tool/hover state on transitions and cancel quest hand waits on disposal.
- [x] Share active-map tool coordinates and hover lookup; preserve battle coordinate offsets.
- [x] Preserve bindings across client cache rewrites only within the same map ID.
- [x] Cover single-renderer transitions and quest/cave/battle browser flows.

## Validation

Engine: 1,648 tests passed, 2 existing skips. API quest/container integration: 21 passed against PostgreSQL. Web: all 3,317 tests passed after the final review fixes, including simulation ownership and same-instance cache binding regressions. Workspace typecheck passes. Repository-wide ESLint passes with 0 errors and 44 warnings, including existing dependency-cycle/unused-symbol warnings and component-stub warnings in tests.

Fresh-build Chromium acceptance: **7/7 passed, retries disabled**. Coverage includes quest entrance/reload, three consecutive pause/camp/re-entry cycles with preserved progress, quest completion, failure and give-up, cave travel costs, squad ATTACK with battle reload, and return from a won cave battle. Each active-board checkpoint requires exactly one canvas. These are automated UI checks, not a claim of manual visual review.

## Ownership rules

Saved domain states may coexist; renderers do not. Specialized world, quest and battle commands remain authoritative in the engine. The shared active-map context is a read adapter, not a new game-rule layer. Quest projections expose only public board geometry, not the seeded solution. Optional board data is retained for legacy test fixtures; live server projections include it.

Gate arrival correction (2026-11-15): normal WORLD gate travel selects a free hex beside the destination map's configured entry object; it never restores the hero's last exploration/quest-marker position. Board-edge crossings keep their arrival-side rule, and Return Scroll portals retain their own linked return coordinates. Regression: `packages/engine/src/world/travel.test.ts`.

Arrival-fix validation: 1,649 engine tests passed (2 existing skips); workspace typecheck and changed-source lint passed. Fresh-build Chromium cave travel and three quest pause/re-entry cycles passed, 2/2 with retries disabled.

Fresh quest marker placement (2026-11-15): accepting a map-placement quest increments the saved quest-owned `placementActivations[questId]` counter. Entrance RNG combines world seed, quest ID and activation count, so each acceptance draws anew from empty reachable hexes. Existing entrance bindings stay fixed through reconciliation, reload and pause/re-entry; legacy logs without counters still deserialize. Quest fixtures preserve these counters.

Quest resolution timing (2026-11-15, corrected by Oleh): the final numbered step resolves the quest immediately through `resolveSeekerPath`, removes it from the active log and records success once (failed paths earn no completion). The saved run keeps an optional `resolution` and emits `QUEST_RESOLVED`; chest/loot/map lifecycle can continue independently. Leaving cannot count success again or overturn the resolved result. No further numbered step-back is allowed after resolution. The door retains its original adjacency-checked `QUEST_PAUSE` behavior. Reconciliation discards suspended resolved runs before a new acceptance, so an old completed map cannot resume as a new quest.

Final-step resolution verification: 1,657 engine tests passed (2 existing skips), 21 PostgreSQL integration tests passed, frontend regressions and workspace typecheck passed, and 3/3 fresh-build Chromium scenarios passed with retries disabled. Browser assertions inspect the quest log before chest opening or departure and after a failed-path reload.

Hand persistence verification (2026-11-16): fixed map-host watch sources so ordinary quest snapshots do not clear the active tool; first wheel activation prioritizes the equipped hand and subsequent cycling follows the actual active tool. Nineteen frontend regressions pass. Fresh-build Chromium opens the chest and takes every stack without re-arming the hand, asserting visibility after each pickup; 1/1 passed without retries.

Quest scale verification (2026-11-16): Treasure Seeker uses the shared world-reference camera zoom, matching battle behavior. Twenty-four camera/lifecycle regressions pass, including narrow viewport scale and focus checks. Fresh-build Chromium compares actual adjacent-hex spacing before/after quest entry through three camp/re-entry cycles with reloads; 1/1 passed without retries. Workspace typecheck and changed-source lint pass.

Pickup warning verification (2026-11-16): weight refusals now reach the general banner as OVERWEIGHT; failed trial grants leave inventory, ground loot and active hand unchanged. Full-bag fixtures explicitly have enough weight capacity to keep slot-full and overweight cases distinct. All 1,658 engine tests pass (2 existing skips), 1,576 targeted frontend/locale tests pass, workspace typecheck passes, and fresh-build Chromium verifies the overweight sword warning with unchanged loot/bag and visible hand (1/1, no retries).
