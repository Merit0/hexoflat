# Map architecture: fixes, optimizations and improvements

Source: read-only audit of the map architecture (2026-11-16, branch `codex/map-object-transitions`). The verdict was **implemented, with targeted defects**: exactly one gameplay board is mounted (`gameplay-board-host.vue`), domain states (world documents, quest run, battle) live on the server and in module-level projections, nothing is saved on unmount, and projections hide the seed and the trail. Keep the design; do not introduce a single persistent Pixi application (recreating a board has shown no measurable cost).

## Done (2026-11-16)

| ID  | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Fix                                                                                                                                                                                                                       | Guard                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P1  | `loot-flight-layer.destroy()` (and a new `play()` replacing a running one) destroyed the flying nodes but left the `runTween` handler on `Ticker.shared`; every frame threw `TypeError` (`_position` is `null` after `Container.destroy`), so every later `Ticker.shared` listener (hero walk tween, portal tweens, later flights) stopped running and `portalFxBusy` could stay `true`, blocking `moveHeroTo`. Trigger: open the Seeker chest and press Return to camp, or loot the last grave and press LEAVE, within the ≤ 800 ms flight. | The layer keeps its `Tween`, cancels it in `clear()` and `destroy()`, and a destroyed layer lands nothing.                                                                                                                | `render/layers/loot-flight-layer.test.ts` (4 tests, all red on the old code) |
| P3  | Quest and battle boards started Pixi from every `ResizeObserver` callback until the app existed; a resize during `app.init` or texture preload created a second `Application` on the same canvas, and the first one was never destroyed.                                                                                                                                                                                                                                                                                                     | One shared lifecycle, `render/use-observed-board-app.ts` (`starting` guard, latest pane size, destroy when unmounted during init, layers released before the app). `use-quest-board.ts` and `use-battle-board.ts` use it. | `render/use-observed-board-app.test.ts` (5 tests)                            |

## Next phases (one chat each, in this order)

### M1. A background world tick never announces presence (correctness, small)

- **Trigger.** Every quest exit (PAUSE, RETURN, GIVE_UP) sets server presence to `camping` (`quest-run.service.ts` `campPlace`), but `world-map-store` still holds the Silesia map. The host mounts the world board and starts the loop at once; `leaveQuestField` waits for `GET /player/world`. A tick 250 ms later with `hasDueWork` (likely: respawns piled up while the loop was stopped) calls `ensurePresence(Silesia)` → `WORLD_ENTER silesia`.
- **Consequence.** On slow networks the server hero goes back to Silesia, and `refetchServedWorld('camping')` can cache the Silesia document under the `camping` key.
- **Fix.** `serverTickAction` skips the tick when `inventorySession.presence` is set and differs from `{currentLocationKey, currentMapId}`; ticks never call `ensurePresence` for a place the hero has not chosen.
- **Tests.** Unit test in `stores/world-map-server.test.ts` with the fake player server: presence = camp, store on Silesia, due spawner → no `WORLD_ENTER` is sent.

### M2. `WORLD_ENTER` is validated by the server; the client starts from server presence (authority)

- **Trigger.** `world.service.ts` moves presence to any `locationKey` without a sealing check, entry price or trip count. The client picks the location from the URL prop and its own `nav` blob (`hex-world-map.vue` watch, `bootstrapWorld`, `heroStore.setLocation`). Opening `/world/cave` loads the cave from the cache and the first action enters it.
- **Consequence.** `WORLD_TRAVEL` rules (2 Will, `trips` that reset the trader refresh price, `sealedUntil`) can be skipped.
- **Fix.** Server: `WORLD_ENTER` is allowed only while presence is `null` or names the same location; otherwise `rejected` with a new code. Client: `bootstrapWorld` and the route prop use `inventorySession.presence.locationKey`; a URL for another location is replaced by the presence route.
- **Cost.** API tests that use `WORLD_ENTER` as a fixture (`world.integration.spec.ts`, `battle-collect.integration.spec.ts`, `quest-run.integration.spec.ts`) move to `WORLD_TRAVEL` or a dev fixture. Check every flow that leaves presence `null` (new hero, quest ENTER) before closing it.
- **Tests.** API: entering another location while present elsewhere is refused and nothing is charged. E2E: a deep link to another location shows the presence location.

### M3. E2E guards for renderer leaks and mid-animation exits (verification)

- Add a test hook `getRenderStats()` (live Pixi apps created by `createHexBoardApp` minus destroyed ones, `Ticker.shared.count`) and assert it in `ActiveBoardComponent.verifyOnly`: one app, no growing shared-ticker count after a transition.
- New scenarios through Feature classes: leave the quest with Return to camp during the chest flight, LEAVE BATTLE during the last grave flight; then walk on the world board and verify the hero token moves (P1 regression in the browser).

### M4. One failing animation cannot stop `Ticker.shared` (robustness)

- `runTween` and `hero-layer.tweenTo` run `onFrame` in `try`; on an error they remove their handler, resolve `done` and report the error, so a broken frame never blocks other listeners.
- Consider moving board animations from `Ticker.shared` to the board's own `app.ticker` (destroyed with the app), as the battle animator already does. Do it only together with M3, because hero and portal tweens are shared by the world and the quest field.

### M5. Leaving a quest loads the world once (optimization)

- Today the exit runs `goToLocation` up to three times: the route prop watch (`QUEST_MAP` → `WORLD` with the stale `currentLocationKey`), `leaveQuestField`, and the prop watch again after `routeToLocation`. Each run deserializes the whole map, replaces `world.map`, stops the tool and redraws every tile.
- Fix: the quest exit installs the refetched world and replaces the route in one step, and the prop watch ignores a key equal to `currentLocationKey`. Combine with M1: the world board mounts only after the world matches presence.

### M6. Indexed tile lookup (optimization)

- Three O(n) scans over ~400 tiles: `world-map-board.vue` `getTileByCoord`, `use-active-map-context.ts` `objectAt` (every hover), `world-map-store.getTileAt`. Workflow §3 already lists O(n) lookup as a known conflict.
- Fix: an engine-side index on `HexMapModel` (`tileAt(coordinates)`, rebuilt only where the tile array is replaced), then use it in the three places. Characterize `getTileAt` first.

### M7. One quest field model per projection (optimization)

- `buildQuestField` runs in `use-quest-run-view.ts` and again in every `useActiveMapContext()` (host, board input, hex tooltip, and one per `equip-token.vue` instance, lazily).
- Fix: one module-level `computed` next to `questRun` in `services/quests/`, consumed by both.

### M8. Stale battle replies are ignored (correctness, small)

- `battle-store.run()` applies `reply.steps` after `await` without checking that the battle is still the same one; a reply that arrives after `close()` or `restore()` can bring a projection back.
- Fix: a generation counter bumped by `prepare`, `restore` and `close`; drop replies of an older generation. Unit test in `battle-store.test.ts`.

### M9. Quest board re-created per run (edge case)

- `use-quest-board.ts` chooses the floor sprite once at start; a different run replacing the projection without a remount (reconnect only) keeps the old floor. Key `quest-field-area` in the host by run identity (`offerId` + `start`), or rebuild the layer when `background` changes.

### M10. Shared camera fit for quest and battle (cleanup)

- `use-quest-board.ts` snaps the camera to device pixels and follows the hero; `use-battle-board.ts` does neither. Move both to one `fitBoardCamera(frame, reference, pane, focus?)` in `board-camera.ts`. Changing battle snapping is a visual change: ask Oleh first.

## Open questions for Oleh

1. The hand-cycling wheel listener is on `window` (`use-hex-board-input.ts`), so the wheel over the right panel also cycles the hand and calls `preventDefault`. Is that intended, or should it be limited to the map pane?
2. M2 changes how deep links behave: should `/world/<other location>` redirect silently to the hero's real place?

## Out of scope

- A single persistent Pixi application or keeping hidden boards mounted (KeepAlive / `v-show`): the one-board rule stays.
- The world board lifecycle (`use-hex-board.ts`): it starts once from `onMounted` with the pane polling fallback of `useBoardCamera`, has no double-start path, and the render skill forbids replacing that measurement.
