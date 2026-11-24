---
name: hexoflat-e2e
description: The layered, selector-free Playwright architecture in apps/playwright — Feature / Page Object / Component layers, the window.__HEXOFLAT_TEST__ hook, and the banned patterns. Use when a task touches apps/playwright/**, writes or fixes an end-to-end test, adds a data-testid, or when an e2e test is flaky, failing, or needs new UI coverage.
---

# E2E tests

The suite is layered on purpose, and the layers are enforced by ESLint rather than by convention.

## The four layers

```
e2e/*.spec.ts   calls ONLY Feature classes. Never sees `page`, a locator,
                or an `expect` against a locator.
Feature         orchestrates Page Objects into a business flow. Owns no
                locators. Every public method wrapped in `this.step`.
Page Object     represents a route: goto, waitUntilReady, URL assertions.
                Composes Components. Holds no locators.
Component       owns the locators of ONE UI region. The ONLY layer allowed
                to call getByTestId / getByRole / locator().
```

A Component exposes **intent** (`fillUsername`, `openSettings`, `clickTile`) and `verify*` methods built on web-first assertions. It must **never return a Locator** — that leaks locators straight back into the layers above and quietly dissolves the whole structure.

See `apps/playwright/src/framework/base-component.ts` and `apps/playwright/README.md` for the reasoning.

## Banned in `apps/playwright/e2e/**` (ESLint errors)

- `getByTestId`, `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `locator` — locators belong in `src/components/*.component.ts`
- Any `page.*` access — go through a Feature
- `waitForTimeout` — wait for a real condition instead
- `import { test, expect } from '@playwright/test'` — import from `@fixtures`

If a spec needs something the Feature layer does not expose, **add it to the Feature**. Do not reach down a layer.

## Never duplicate engine logic in tests

Game state and hex geometry are asked of the running app through `window.__HEXOFLAT_TEST__`, implemented in `apps/web/src/e2e/` and enabled by `VITE_E2E_HOOKS=true` in the e2e build only.

This exists so tests never re-implement `packages/engine` logic. If a test needs to know where a hex is, whether a tile is revealed, or what the hero's position is — ask the app, do not recompute it. Extend the test API in `apps/web/src/e2e/create-test-api.ts` rather than duplicating a rule.

State that the real game cannot reach cheaply is granted through hooks, not by clicking: `setWill(n)`, `prepareKnowledgeWorld(n, locationKey = 'silesia')` (async: sets Will and moves the hero on the server through `POST /player/dev/relocate-fixture`, then shows that location; the only way to put the hero in another location, since `WORLD_ENTER` there is refused and `page.goto('/world/<other>')` silently redirects to where the hero stands), `findTilesWithKeyIn(locationKey, key)` / `HexBoardComponent.verifyTileCountWithKeyIn` (objects on another location's map from the cached world, e.g. the camp while the hero is in Silesia), `setSkillRank(skillId, rank)` (skills priced above Will capacity, e.g. the Teleport skill), `placeHexobjectNextToHero(key)` (any hexobject by key on a free hex next to the hero: a squad token in camp, since reaching one in the generated cave is random, queried with `isBattleEngaged`; or a loose item to pick up), `finishBattle('victory' | 'defeat')` (ends the open battle so a spec can test leaving it), `giveHeroTheTurn()`, `giveEnemyTheTurn()` (an enemy two hexes from the hero), `crowdTheHero()` (two enemies beside the hero), `getBattleSnapshot()` (order, draws, reaction stage, creatures with hp/position, wounds, hero distances, aim options, revealed shields), `getBattleHexPoint(q, r)` (canvas point of a battle hex for hover/tap), `crowdTheHero(adjacent, far)`, `holdTheWindowOpen(ms)` (keeps the 5 s block window open for slow taps), `giveHeroTheTurn(will)`, `findTilesWithKey` / `countExistingNeighbours` (border checks) and `getBattleHands()` (all in `apps/web/src/e2e/battle-hooks.ts`; since D4b-4 B5 the battle is server-held, so the state-changing battle hooks are async and call `POST /player/dev/battle-fixture` (engine `battle/battle-fixtures.ts`), which only works when the API runs with `HEXOFLAT_E2E_FIXTURES=1`; `getBattleSnapshot().wounds` is always empty; battle specs live in `e2e/combat/battle-flow.spec.ts` through `BattleFlowFeature`, the block window is closed by the 5 s timer or TAKE HIT, and a battle starts straight from ATTACK; page exceptions are collected by `PageErrorsComponent`). Add a hook in `create-test-api.ts` + `test-api.types.ts` instead of writing helper logic in a test.

Keep the `import.meta.env.VITE_E2E_HOOKS !== 'true'` guard **inline** at its call sites so Vite statically drops the hooks from production bundles.

## Flakiness: the trap that already bit this project

`expect.poll()` can pass on a **stale value before a debounce settles it to the buggy one**. A test that polls a value which is written twice — once optimistically, once after a debounce — can go green on the first write and never observe the second.

When asserting on anything debounced or delayed (saves are debounced ~750ms), assert on the settled state, and make sure the condition could not have been satisfied by the pre-debounce value.

Prefer web-first assertions and real conditions (`toHaveAttribute`, `expect.poll` on an app-reported value) over any sleeping.

Waiting for the board specifically: the canvas exposes `data-ready` once `onBoardReady` has fired. Use that, not `onMounted` timing or a fixed wait.

## Running

Run a subset with `sh scripts/pre-push-e2e.sh e2e/<group>/<spec>.spec.ts` (own ports 3101/5273; it starts Postgres only if it was not running and stops only what it started). Rebuild `packages/engine` first if engine code changed.

### Groups and tags

Slow-suite split (2026-11-21): scenarios whose latest successful local Allure run
exceeded 30 seconds live in `e2e/slow/<group>/`, retaining their functional
`@<group>` tag. Push runs (`E2E_PRE_PUSH=1`) exclude that folder unless
`E2E_INCLUDE_SLOW=1`; CI/direct full runs include it. Run the dedicated suite with
`pnpm test:e2e:slow` (two workers), or a slow spec through
`E2E_INCLUDE_SLOW=1 sh scripts/pre-push-e2e.sh e2e/slow/<group>/<spec>.spec.ts`.
Impact-map globs include both locations and the map checker resolves the
functional folder below `slow`. Keep faster cases in the regular folder when
splitting a spec. `E2E_ALL=1` selects all groups but does not override the slow
exclusion; combine it with `E2E_INCLUDE_SLOW=1` for a full local push run.

Specs live in `e2e/<group>/` (`auth`, `board`, `camp`, `combat`, `hero`, `shell`). Each file wraps its tests in one `test.describe(title, { tag: ['@<group>'] }, ...)`, so the folder and the tag always agree. `@smoke` is an extra tag on single tests (login, hero movement). Run one group with `pnpm --filter @hexoflat/playwright e2e:group @board`.

### Impact selection (`apps/playwright/impact-map.ts`, `scripts/select-e2e*.ts`)

`impact-map.ts` (Zod) lists `global`, `ignore`, `boundaries` and, per group, `roots` + `specs`. `selectE2E(changedFiles, impactMap, depGraph)` is pure; `build-dep-graph.ts` builds the graph with dependency-cruiser. Try it: `pnpm --filter @hexoflat/playwright e2e:select --files <path>...`. Unit tests: `pnpm --filter @hexoflat/playwright test`. A new web feature folder belongs in some group's `roots`; an unmapped file runs the whole suite on purpose.

### Pre-push picks the groups (`.husky/pre-push`)

The hook asks `scripts/select-e2e-cli.ts --pre-push` (stdin = git's ref lines) which files the push changes: existing branch = `remote..local`, new branch = `merge-base origin/main..local`, deletion = nothing, several refs are merged; an unknown remote commit or a missing `origin/main` means the whole suite. It prints the reason per file to stderr and `none` / `all` / `grep:<regex>` to stdout, then runs `scripts/pre-push-e2e.sh --grep "<regex>"`. The selection happens before any typecheck or build. Overrides: `E2E_ALL=1` (whole suite), `E2E_SKIP=1` (skip with a warning; CI still runs everything). `--no-verify` works as always.

CI (`ci.yml`): the `e2e-plan` job runs the same selector on the gating PR (diff `base.sha...HEAD`) and passes `--grep` to `e2e-tests.yml`; pushes to `main` (not `game-dev-vite`) and the nightly schedule run the whole suite (nightly does not deploy Pages). `pnpm run e2e:map:check` (a lint-job step) fails when a test lacks its folder's `@<group>` tag, has an unknown tag, sits outside the group folders, or a group has no spec; it also prints web files no group owns.

E2E runs in CI after lint/typecheck/build/unit-tests pass, and publishes an Allure report with trend history to GitHub Pages on every PR and trunk push.

## Checklist before finishing

- [ ] Spec calls only Feature methods — no locators, no `page`, no `waitForTimeout`
- [ ] New locators live in a Component; no Component returns a Locator
- [ ] No engine logic recomputed in test code — asked of `window.__HEXOFLAT_TEST__`
- [ ] Assertions on debounced state cannot pass on the pre-debounce value
- [ ] New Feature methods wrapped in `this.step`

## Battle specs (2026-11-02)

- A defender with no shield in hand takes a strike at once, with no block window (`strikeAndReact`). A spec that waits for the block window must start with `startBattleNextToTheSquad({ withShield: true })`.
- With a foe adjacent or selected, the wheel opens the tool hex ON that foe's hex, and its Attack button covers the canvas there. `BattleTabComponent.hoverBoardPoint` therefore skips the hover when the tool hex already covers the point; do not add `force: true` hovers.
- `giveHeroTheTurn` / `giveEnemyTheTurn` also clear `battle.wounds`, because an unshielded hero is wounded by the first enemy turn before the hook runs.
- Run a subset with `sh scripts/pre-push-e2e.sh e2e/combat/battle-flow.spec.ts -g "<title part>"`; the log of a failing run names the spec and `test-results/**/error-context.md` has the message.

## Stash specs (2026-11-08)

- `e2e/hero/stash.spec.ts` goes through `StashBoardFeature` (open by hand with the real OPEN flow, drag, split, quick move, filters, Store, Sort, reload) and `UnlockStashChestFeature` (coins held in a hand, the "Unlock" action over the chest). Locators live in `StashBoardComponent`; state is arranged and read through the hooks `setStashChests`, `getStashChests`, `setBag`, `getBag`, `setStash`, `getStash` (owned cells only; `apps/web/src/e2e/stash-hooks.ts`).
- Drags use real pointer events (`mouse.down` / stepped `move` / `up`, `Shift` held for a split). Dropping "on the panel" targets the `stash-count` or `stash-load-value` label, never a cell.
- Stash cells are addressed by their global index (chest 2 starts at 42); the bag shows items sorted on top, so `stash-bag-cell-N` is a display position and `data-drop-index` is the real bag cell.
- The old OPEN-on-stash "chest is broken" alert no longer exists: OPEN on the Stash Chest opens the board.
- Escape during a stash drag: hold the drag with `holdBagItemOverStashCell`, press Escape, then `releasePointer` (the drag is already cancelled, so nothing drops).
- The camp map holds no loose gear any more. To get an item on the map use `TakePlacedItemFeature(key)` (`place`, `take`, `verifyIsOnTheMap`, `verifyIsTaken`) or `HexInfoTooltipFeature.placeItemAndHover(key)`; both use the `placeHexobjectNextToHero` hook. A fresh stash starts with the starter gear in cells 0-3 of the first chest: call `givenEmptyStash()` when a test needs clean cells.

## The hero lives on the server (2026-11-09)

- Every worker has one registered user, and its hero is now stored in the database, so state would leak between tests. The auto-fixture `freshHero` (`src/fixtures/test.ts`, `src/api/reset-hero.ts`) calls `POST /player/dev/reset` before each test; it uses the registration's session cookie as the bearer token and only logs in (throttled) if a logout revoked it.
- A new hero holds nothing: no scrolls, no gear, no coins. The camp gear (sword, axe, shield, pickaxe) lies in the first stash chest, which `StashBoardFeature.openByHand()` opens for free through the server (once). Coins and other items come from fixture hooks (`grantInventoryItem`, `setBag`, `setStash`, `setStashChests`), which mirror to the server, or from `seed-hero` outside the tests. `settleInventorySync()` waits until the server has what the page did.
- Persistence specs: `e2e/hero/hero-persistence.spec.ts` through `HeroPersistenceFeature` (reload, forged browser storage, a second tab taking the hero over).
- A fresh e2e hero is full (50/50 Will), so the Book of Will cannot be started: lower Will first with `KnowledgeHallFeature.spendAllWill()` (`setWill(0)`); counts of ranks bought with 'all' Will start from 50.
- After a fixture hook (`setWill`, `setSkillRank`, `prepareKnowledgeWorld`, `grantInventoryItem`, `setBag`...) the server learns of it asynchronously: wait with `settleInventorySync()` before `page.goto` or a reload, or the reload shows the old state. Return Scrolls are not a starter item any more: use `VerifyInventoryFeature.givenItem`.
- The world (maps, fog, the hero's place, a battle) is on the server as well: reload features first wait for it (`settleInventorySync()` includes the expedition flush). `freshHero` also wipes the world, so every test starts in a new world. `HeroPersistenceFeature.wipeEverythingTheBrowserKeeps` proves it by clearing the browser storage before the reload.

- **Wheel over a panel vs the board (WHEEL-1, 2026-11-17).** The hand wheel listens on the board element only. `FillEventsLogFeature.fill(n)` (hook `logTestEvents`, local UI log, no server) makes the Events tab scrollable; `ScrollWithWheelFeature.overTheEventsLog()` / `overTheBoard()`, `VerifyEventsLogFeature.verifyScrolledDown()` (reads `scrollTop` of `events-tab-content`) and `VerifyToolActionFeature.verifyHandIsIdle()`. Check the scroll first: it proves the wheel event was handled before the negative tool check.

## Shop hooks (SH3, 2026-11-10)

- `apps/web/src/e2e/shop-hooks.ts` (spread into `createTestApi`): `getTrader(key = 'ilva')` returns `{ key, serial, trips, goods, buyback, refreshPrice }` read from the served projection, `getOpenTrader()` the key of the open shop board or `null`, `getWalletCoins()` coins in the bag plus the hands (engine `walletCoins`), and `setTrader({ goods?, buyback?, trips? })` which first waits for `settleInventorySync()`, then posts `/player/dev/trader-fixture` with `X-Player-Session` and applies the returned `aggregates.progress`. The API must run with `HEXOFLAT_E2E_FIXTURES=1`. Goods are never rolled in the page: arrange them with `setTrader`, give coins with `grantInventoryItem`.
- The trader is served only to a hero beside the stall: walk there for real (`MoveHeroFeature.moveAdjacentTo`) and OPEN it with the hand, as the stash specs do.

## Shop specs (SH6, 2026-11-11)

- `e2e/hero/shop.spec.ts` (`@hero`, 42 tests) goes through `OpenShopFeature` (`open` = real walk + OPEN with the hand, `openAfterReload`, `close`, `pressEscape`, `walkAwayFromTheStall`, `verifyIsOpen/Closed`) and `ShopBoardFeature` (`givenGoods/givenTrader/givenBag/givenWill`, buying by drag to a bag cell or the bag panel, Shift half, double click, Enter, selling by drag onto the trader/goods panel, right click, buyback, New goods, and the `verify*` readers). Locators live only in `ShopBoardComponent` (`shop-board.component.ts`, on `CampingMapPage.shopBoard`); the real pointer drag is the shared `components/pointer-drag.ts` (`pointerDrag(page, source, target, { shift, release })`), the stash component keeps its own copy.
- Test ids: `shop-board`, `shop-close`, `shop-trader-banner|-name`, `shop-coins` (`data-coins`), `shop-sell-rate`, `shop-goods-pane`, `shop-goods-cell-<i>` / `shop-buyback-cell-<i>` (`data-item-key`, `data-item-amount`, `data-price`), `shop-price-<i>` (`data-price`, `data-affordable`), `shop-tab-goods|-buyback` (`aria-selected`, `data-count`), `shop-tab-buyback-badge`, `shop-buyback-pane` (only while the Buyback tab is open), `shop-refresh` (`data-affordable`, click refreshes at once), `shop-refresh-price` (hover tooltip, `data-price`), `shop-drag-badge` (`data-label` = drop kind, e.g. `cantAfford`), `shop-card` (`data-mode` buying|buyback|trading, `data-item-key`), `shop-card-name|-meta|-reason|-note|-trade-price`, `shop-card-action`, `shop-qty-dec|-inc|-max|-value` (`data-qty`), `shop-bag-sum` (`data-sum`), `shop-slot-amount`, `shop-sold-label` (sibling of the cell, inside the slot), `shop-toast`, `shop-toast-undo`, `shop-help` (a clicked cell also has `data-selected`). GOODS has 8 cells (`TRADER_GOODS_SLOTS`), BUYBACK 7. The BAG is the stash's own pane: `stash-bag-cell-<i>`, `stash-load-value` as the "drop on the bag" point.
- R6 discounts: `shop.spec.ts` has 3 more tests + a tab-text-bold check (`verifyTabTextIsBold`, computed font-weight >= 700) (exact guess, wrong guess = Wasted, Buy disabled until a number and the discounted price never shown), via `ShopBoardFeature.enterOwnPrice/verifyOfferBadge/verifyOfferWasted/verifyToastText`; ids `shop-card-price-input`, `shop-offer-badge-N`, `shop-wasted-label`; `setTrader` goods take `discountPercent`/`wasted`.
- R7 Trade tab: 6 tests in `shop.spec.ts` (`own trade slots`) plus a Refresh-only-on-Goods test; component/feature `openTradeTab`, `selectOwnSlot`, `pressSetPrice`, `verifyOwnSlot`, `verifyTradeCount`, `verifyCardReason`, `verifyListingsOnServer` (hook `getListings`), `setTrader` takes `listings`; ids `shop-tab-trade`, `shop-own-cell-N`, `shop-own-price-N`, `shop-card-reprice`.
- The Trade tab is behind `VITE_SHOP_TRADE_TAB`; the e2e web build turns it on in `playwright.config.ts`, so Trade specs need no extra step (the locked state is covered by `composables/use-trade-tab-flag.test.ts`).
- Oracles: stack prices and sale values are constants in `src/config/test-data.ts` (`StackCoinPrices`, `StackSellValues`, `GUARANTEED_GOOD`, `REFRESH_BASE_WILL`) copied from the approved plan; gear is a token, so its price is read from the token in the projection (`ShopBoardFeature.goodsTokenPrice`, `soldFor`, `readTradingCardPrice`) and checked by relations (coins change by exactly that price, `verifySoldBelowTheTokenPrice`: sale < token price and the buyback keeps the token id); state is read through `getTrader`, `getWalletCoins`, `getBag`, `getKnowledge` and arranged with `setTrader` (goods, buyback, `trips`), `setBag` (coins are an ordinary bag item), `setWill` + `settleInventorySync`. Boundary tests: exactly the price (40 coins for a 40-coin shield) vs one coin short, 19 vs 20 Will, 40 Will for the second refresh.
- Walking away: `MoveHeroFeature.stepAwayFrom(token)` / `HexBoardComponent.stepAwayFrom` clicks only FREE neighbours, farthest from the object first (`moveOneStep` clicks the stall hex itself first, and the working tool hex lies over it). This spec found a real bug: `heroStore.moveHeroTo` closed the stash but not the shop, so a step with the shop open was silently ignored (the hand stayed "dragging"). Fixed by `services/hero-movement/close-boards-for-walk.ts`; unit test `composables/shop-walk.integration.test.ts` (no mocks, mirror of `stash-walk`).
- Not in e2e: a battle opening while the stall is open. The hand is busy on the stall, so the tool hex cannot be aimed at a squad (no ATTACK button); it is covered by `use-shop-session.test.ts` (`battle.inBattle` closes the board) and the API test `BATTLE_OPEN` in `shop.integration.spec.ts`.
- Touch: the drag is pointer-event based and `board-cell.css` sets `touch-action: none` on every cell, so the same code path serves a finger. Playwright's `touchscreen` can only tap, so a touch drag is not automated; real-device check is deferred (the hex tooltip touch is postponed as well).

## Cleaning test users

Each worker registers an `e2e-…` user per run and nothing deletes them. `pnpm --filter @hexoflat/api e2e-cleanup` deletes them (heroes, expeditions, journal cascade): default is users older than 24 h, `--older-than-hours N`, `--all`, `--dry-run`. It is refused in production.

## Quest specs (QB3, 2026-11-12)

- `e2e/hero/quests.spec.ts` through `QuestBoardFeature` (open = real walk + the hand's Read on the board) and `QuestBoardComponent`; ids `quest-board`, `quest-card-<id>` (`data-state`), `quest-accept|claim|abandon-<id>` (abandon only exists inside the pinned details card: the component clicks `quest-row-<id>` first; the price button of a seeker card is `quest-start-<id>`, `quest-short-<id>` appears in the hover card), `quest-progress-<id>`, `quest-tracked-<id>` (`data-ready`), `quest-message`, `quest-slots`, `quests-tab-mark`. Hooks: `getQuests`, `getOpenQuestBoard`, `setQuests` (progress is set by the fixture; a real CUT needs an axe in the hand). The hero may already stand beside the board at the start, so `moveAdjacentTo` does not move; use `moveAwayFrom` to leave its reach.

## Treasure Seeker e2e (Q6)

- Field state and clicks: `QuestFieldComponent` (`getQuestField` snapshot with `hexes`, `pathHexes`, `chest`; `getQuestHexPoint` gives canvas-relative pixels from the quest camera). A run ends the field at once (stranded, give up), so never poll the path after the last step. After ending a run the quest board panel is still open on the cards, do not walk to the board again (the armed hand blocks the hover). Card I numbers are 1,2,3…; pick hexes by number instead of reimplementing the rule.

## Loot chest specs (L2c, 2026-11-13)

- `e2e/hero/loot-chest.spec.ts` (`@hero`, 5 tests) through `LootChestFeature` and `LootBoardComponent` (`loot-board.component.ts`, on `CampingMapPage.lootBoard`). A full chest is put beside the hero with `placeItemNextToHero('chest')` (the cave one is random to reach) and opened with the real OPEN; loot is read with `getGroundItems` (hex, key, quantity), chests with `getChests` (`full`/`empty`), flights with `isLootFlying`; wait for `data-ready` after the open, never for a timer.
- The hand stays armed after an action and a click on the map is ignored while it is, so press Escape (`putTheHandDown`) before stepping.
- An opened chest offers no OPEN in the ring, so the `CHEST_EMPTY` text is checked through the hook `tryOpenChest` (real command, real text). The placement hook cannot make stacks: the full-bag test takes an axe.

## Battle collection specs (L3b, 2026-11-14)

- `e2e/combat/battle-collect.spec.ts` (`@combat`, 3 tests) through `BattleCollectFeature` (`winTheBattle` = real battle + `finishBattle('victory')`, `lookThroughEveryGrave`, `pickUpEverythingLyingAround`, `verifyLeavingAsksOnceWhileLootRemains`, reload) and `BattleCollectComponent` (on `CampingMapPage.battleCollect`). State comes from `getBattleCollect()` (`collecting`, `lootLeft`, `heroHex`, graves and items with `standHexes` = free neighbours computed by the engine, never a seed or a table); the hero is walked next to a target by clicking a `standHex`, then the wheel opens the hand tool hex, which sits on the adjacent grave/item by itself; the eye is read from `aria-label` (`Read`/`Читати`) because the button is an icon.
- The tool hex covers its own target hex, so hovering that hex is skipped (same rule as `BattleTabComponent.hoverBoardPoint`).
- Ids: `battle-leave-warning`, `battle-leave-confirm`, `battle-leave-cancel` (the plain `battle-leave` button is hidden while the warning shows).
- The first look-through in a fresh test was flaky once (passed on retry); wait for `waitForBoardStill` before clicking.

- Quest board (2026-11-14): the filter chips are gone (no `quest-filter-*`); `quest-slots` is the «Quests taken» bar; the details card's `quest-abandon-<id>` button reads «Return» and the active row's `quest-progress-<id>` shows «Return» while hovered, so read progress text with the mouse away from it; the quest tracker hex has `quest-tracker*` testids; rows drag between sections (`quest-group-active|available`, ghost `quest-drag-ghost`), not covered by e2e yet.
- Quest details: `QuestBoardComponent.verifyRule(questId, phrases)` hovers the row and reads `quest-details-<id>-rule` (replaced `verifyChips`, there are no `quest-chips-*` any more); the take price has `quest-price-<id>` and the class `is-short` while Will is too low.

## Seeker chest loot specs (QC2, 2026-11-14)

- `apps/web/src/e2e/test-api.types.ts` (alias `@web-test-api`) must never import `@hexoflat/engine`, not even a type: playwright has no engine dependency, so turbo does not build the engine before its typecheck and CI fails with TS2307 while a local run passes on an old `dist` (2026-11-23). Describe the fields the suite reads as local `Test*` interfaces; `createTestApi` returns `HexoflatTestApi`, so the web typecheck still checks the real projection against them. Check: `npx tsc --noEmit --listFiles | grep -c packages/engine` in `apps/playwright` must print 0.

- Generated quests (phase 5, 2026-11-23). Use `getQuestBoard()` to read the public offer list. Resolve a template to an issued offer before addressing a card, and use its target to drive the run or verify progress. Done counters still use template IDs. The guarded quest fixture can advance a generated count quest that is already accepted and can backdate the saved day to exercise real rollover. The board spec compares the same offers across desktop and touch and plays the pilot through the Book of Will. Run preparation can follow the Silesia approach through normal movement commands via `followQuestApproach`. The world-entry spec walks the approach with the pointer.

- `e2e/hero/quest-seeker-loot.spec.ts` (`@hero`, 4 tests) through `QuestRunFeature` (`verifyHeroOnTheEmptiedChest`, `takeEveryStack`, `takeOneStack`, `stepOffTheChest`, `clickTheChest`, `reloadAndVerifyLootKept`, `verifyNextCardOpen`) and `QuestFieldComponent` (`readBagTotals`, `verifyBagTotals`, `verifyChestEmpty`, `verifyGroundCount`). The loot is random, so the tests read the stacks from `getQuestField().ground` (`hex`, `itemKey`, `quantity`; `chestEmpty`) and check the bag by delta, never by a fixed table.

- Lost treasure (QC2b): `e2e/hero/quest-seeker-lost.spec.ts` through `QuestRunFeature.followAFalseTrailUntilTheTreasureIsLost/verifyTheTreasureIsLost/leaveTheLostMap`; ids `quest-run-lost`, `quest-run-lost-hint`, `quest-leave-map`. The `wrong trail … ambush` test in `quest-seeker.spec.ts` is stale (no chest on a false trail while `ambushEnabled` is off).

## Messages about events: only the general warning banner (Oleh, 2026-11-14)

- Every message about an event or a refusal (slots full, no room, not enough Will, loot refused…) is shown ONLY by the general warning system, `heroToolStore.setActionMessage` -> `action-alert-banner`. No board or panel has its own message line for events. E2E therefore asserts on the banner: `ActionAlertBannerComponent` (`campingMap.actionAlertBanner`, `verifyIsVisibleMatching`), exposed to specs through a Feature method (`QuestBoardFeature.verifyWarning`). Never assert on a board-local `*-message` element, and a new refusal needs no local text element. The banner clears itself after ~5 s, so assert right after the action.
- The quest board's `quest-message` / `QuestBoardComponent.verifyMessage` is the old local line (still used by the Seeker run panel specs); do not copy it for new checks.

- Shared world/quest tool input (2026-11-15): the `three consecutive complete runs` case in `quest-seeker-loot.spec.ts` keeps one hero, inventory and completion count across three First Trail runs, refilling only Will before each. It opens the chest and takes all loot via real wheel/hover/tool-button input. Run through `scripts/pre-push-e2e.sh` with the dedicated hooks-enabled frontend. A quest panel must not block the quest wheel handler; the world handler is disabled while a run exists.

- World entry (2026-11-15): `QuestWorldEntryFeature` / `QuestEntranceComponent` and `quest-world-entry.spec.ts` verify accept-without-entry, a real Silesia walk, hand OPEN, four quest-mode tabs, camping portal pause and re-entry. `QuestRunFeature.startFirstTrail` uses this world flow. Existing number/price specs temporarily provide Will for the Silesia approach and restore their quest Will before OPEN. Quest reload helpers wait for the quest field, not a `/world/camping` URL. New public geometry: `getQuestField().exit`.

- Map transitions (2026-11-15): `quest-world-entry.spec.ts` exercises three consecutive trail-step/reload/backtrack/camp-portal/camp-reload/re-entry cycles. It compares the full public field snapshot and stable marker coordinates, and checks `/world/treasure-seeker-map`. Backtracking intentionally removes trail progress; nonzero progress persistence is checked by reload before backtracking. Cave gate input is covered by will-economy, enemy ATTACK/battle reload by squad-actions.

## Active-board transitions (2026-11-15)

`ActiveBoardComponent` owns the world/quest/battle canvas locators and asserts exactly one mounted canvas, visibility, readiness and exactly one live Pixi app (`getRenderStats().liveApps`, M3). `RenderHealthFeature` guards against renderer leaks: `recordTheIdleWorldBoard()` before a scenario, `verifyTheWorldBoardIsClean()` after it (no shared-ticker listener above the idle baseline, a step whose hero token tween finishes). Mid-animation exits: `QuestRunFeature.openTheChestAndReturnWhileTheLootFlies` and `BattleCollectFeature.lookThroughGravesAndLeaveWhileTheLootFlies` (Bone Court, the king always drops loot), timed with `LootBoardComponent.verifyLootFlying` / `lootStartsFlying(ms)`. `CampingMapPage.waitUntilReady` waits for the actual active board, including restored battles, rather than a hidden world canvas. Quest world-entry coverage checks the cloned field on the first entry (`QuestEntranceComponent.readOrigin` before OPEN, `verifyClonedField`: border = only the camping door on the marker hex, hero at his world hex, no chest/loot, impassable terrain equal to the world's through the hooks `getImpassableTerrain()` and `getQuestField().terrain`), three pause/camp/re-entry cycles, hover isolation and Inventory hand anchoring (`freeNeighbour`, no tree/rock ring any more). On the cloned field a false line that runs into water or the map edge dead-ends and ends the run as `lost` at once (engine `falseDeadEnd`), so `stepOffTrail`/`stepOnAnyFreshHex` pick the candidate with the most open fog around it (`QuestFieldComponent.fogAround`, hook `getQuestField().fog` minus `terrain` and `border` hexes; fog also covers impassable terrain, and counting it picked a cramped wrong hex, 2026-11-23). Quest-run specs need `test.describe.configure({ timeout: 120_000 })`: every run now travels to Silesia and walks a Silesia-sized field (the three-run loot test uses 300 s and empties the bag between runs with `QuestRunFeature.emptyTheBag`, since three seeker-1 chests exceed the 10 kg carry limit). Squad and battle flow features assert board replacement on entry/reload/return. After a reload that may land in a battle or a quest, wait with `campingMap.activeBoard.waitForReady()` (or `waitUntilReady` on the camp URL), never `hexBoard.waitForReady()`: the world canvas is not mounted then (the battle-collect reload step was stale until 2026-11-16).

Persistent quest hand (2026-11-16): `gameplay-board-host.vue` watches map identity through separate Vue watch sources, not a freshly allocated tuple from each active-context projection. Quest movement/chest/pickup snapshots must not reset the tool; actual board transitions still do. Shared wheel input selects an equipped hand first when the tool is inactive, whichever slot holds it, then keeps normal slot cycling. Browser loot coverage checks the hand remains visible after opening the chest and every pickup.

Quest camera scale (2026-11-16): the board host supplies the saved world frame to `quest-field-area.vue`; `useQuestBoard` reuses `fitAtReferenceZoom`, as battles do, instead of fitting a separate quest zoom. The shared helper accepts optional hero focus for clamped following on larger fields. Quest offsets use the same pixel snapping as the world, and reference/viewport changes re-fit without mounting a background canvas. Browser entry checks compare actual screen spacing between adjacent world and quest hexes.

Quest pickup refusal feedback (2026-11-16): `useQuestRunActions` sends every refusal through the shared action banner, never only a panel-local message hidden behind Inventory. Shared `pickupStack` performs one inventory grant in a trial draft, preserves inventory/events/ground on refusal, and reports `OVERWEIGHT` separately from `BAG_FULL`. Quest and battle collection share this behavior and localized carrying-limit text. Duplicate swords remain allowed when weight and slots permit.

## Item tokens (LG5c, 2026-11-18)

- Gear names are generated (`Reedwoven Sword of the Herald`), but they always hold the type word, so `/Axe/i`-style title checks still work; never assert an old hand-written title or a fixed gear price.
- `e2e/hero/token-look.spec.ts` (LG-13) through `TokenLookFeature` (`rememberBagItem`, `verifyLookComesFromTheToken`, `verifyBagItemLooksTheSame`) and `HeroInventoryComponent.readGridItemLook(itemId)` (`{ title, lines, sprite }` from the tooltip and the token icon). It uses the Seeker chest (`QuestRunFeature.takeStackOf`), because the camp chest may roll no gear.

## Token dev grant (LG5e, 2026-11-18)

- `VerifyInventoryFeature.givenTokenItem(spec)` (hook `grantTokenItem`, sender `grantTokenFixture` in `inventory-sync.ts`) sends `DEV_GRANT_ITEM` with a token spec `{ type, tokenType, mapTier, attributes?, price? }` (`realm` before DA3b): the server mints the token with `TokenFactory.createBase(ctx, overrides)` and sets the given attributes and price; it is refused (`FORBIDDEN`) unless the API runs with the e2e fixtures flag outside production. It returns the minted token. Use it for gear with a fixed price or fixed attributes; `ShopBoardFeature.givenTokenInBag` / `givenDiscountedToken` (the minted token is passed into `setTrader` goods, so a discount has a whole-coin result).
- `verifyTraderGoods`/`verifyTraderBuyback` compare cells without `token`; read tokens with `ShopBoardComponent.readGoodsToken`.
- `shield-max-health.spec.ts`: hearts come only from the `heart` attribute in half-hearts (`NO_ATTRIBUTES` = 0, `ONE_HALF_HEART` = +0.5, so 3/3 -> 3.5/3.5). The fireplace refuses with «already full» while less than one whole heart is missing (`missingHealth < 1` in `action-starters-registry.ts`), so the heal test starts at 2.5/3.5.

## Equipment sight (A01, 2026-11-19)

- `e2e/board/dungeon-fog.spec.ts` includes `EquipmentFogFeature` scenarios for `fog` +1/+2. Each walks once with the token in the bag (radius 1), equips it through the real shield-slot drag, walks again (radius 2/3), then reloads and compares the complete explored-fog snapshot.
- Helm generation is disabled. `grantLegacySightToken(bonus)` in `inventory-hooks.ts` grants a normal shield token, adds the owned legacy `fog` attribute, and persists it through existing `pushInventoryFixture`/dev-only `DEV_SET_INVENTORY`. This tests retained owned attributes without enabling helmets or relaxing the factory restrictions. Production content stays unchanged.
- `fog-hooks.ts` answers `findFogStep` and `getFogTiles(center)` using engine enterability/hex-distance functions. A candidate must have still-hidden tiles at distances 2 and 3, preventing assertions from passing on explored fog. Geometry stays inside the app.
- `EquipmentFogComponent` checks every tile against its pre-step state: only the requested radius becomes newly revealed; explored tiles remain visible. It waits for actual hero coordinates/fog, settles inventory before reload, and compares the saved snapshot afterward.
- Run `sh scripts/pre-push-e2e.sh e2e/board/dungeon-fog.spec.ts` (4 tests: 2 attribute scenarios + 2 existing dungeon checks).

## Equipment Will (A02, 2026-11-19)

- `e2e/hero/equipment-will.spec.ts` uses `EquipmentWillFeature`/`EquipmentWillComponent`: bag has no effect; real shield-slot drag raises 50→55 with no refill; a filled bonus is clamped back to 50 by the hand-icon unequip; reload/re-equip retain the correct values. A +10 token verifies a low balance stays unchanged with capacity 60 and after removal.
- `grantWillToken(bonus, mapTier = 1)` mints a shield at the source tier with `will` through the standard dev token grant and factory validation. Will is available to every equipment group with a +1…(10 × source tier) range, without a total equipment cap (Oleh correction after A02). The sight fixture remains legacy-only because fog is restricted to helmets. Both hooks keep inline E2E guards and validate bonuses.
- `getKnowledge` now exposes actual `capacity`; `getKnowledgeRules().capacity` is still the base constant. The component checks both server knowledge projection and visible `hero-will-value`. `setWill(55)` is valid only after equipping capacity 55; settle before reload.
- Run `sh scripts/pre-push-e2e.sh e2e/hero/equipment-will.spec.ts e2e/board/dungeon-fog.spec.ts` to cover Will plus the shared sight fixture.

- Will scaling correction: a third scenario grants a tier-4 +40 shield through the normal factory, verifies 50/90 without refill, fills/reloads at 90/90 and unequips back to 50/50.

## Equipment Deft Hands (A03, 2026-11-19)

`combat/equipment-use.spec.ts` uses `EquipmentUseFeature` and `CampingMapPage.equipmentUse`: owned legacy shield with `deft-hands`, real equip drag, potion in right hand, battle at exactly its use cost. Bag bonus leaves price 3; equipped +1/+2 costs 2/1. Hand enabled state/meta, healing, consumed hand and remaining Will are checked. Potion is dragged from Inventory into the right hand while the battle is open; the hands gate sends set-hands to the server. Wheel opens the action stage. Tool cost is covered by web unit tests. Hook `grantLegacyDeftHandsToken(1|2)` uses the dev-only owned-token replacement, because glove generation remains disabled. Run through `scripts/pre-push-e2e.sh`.

A03 extended coverage (2026-11-19): `equipment-use.spec.ts` has 6 cases. New cases: insufficient Will with disabled hand and unchanged persisted hero/hands/balance after reload; actual hand-icon removal restores price 3; same-type equipment replacement changes price 2→1 and survives reload. Feature grants the spare before battle and selects it via the read-only `getInventoryItemIdByTokenId` hook, then real Inventory drag. No force-click on disabled USE. This test exposed the token identity bug in hand syncing; the engine and inventory gate now carry optional token IDs.

Dungeon return and victory tools (2026-11-19): `DungeonExitFeature` / `board/dungeon-exit.spec.ts` walks to the real Silesia cave entrance and performs three ENTER/exit/reload cycles, checking engine-reported distance 1 and unchanged saved coordinates. Use `activeBoard.waitForReady` after non-camp routes; `CampingMapPage.waitUntilReady` expects camping. `BattleCollectFeature.verifyToolActivationAfterVictory(wheel|inventory)` requires a hidden tool first, verifies all enemies dead, activates through the chosen real input, then READs a grave. The Inventory route must not fall back to a wheel action. Collection component exposes `verifyToolHidden/Visible`.

## Equipment Smart Step (A04, 2026-11-20)

`hero/equipment-smart-step.spec.ts` uses EquipmentSmartStepFeature / CampingMapPage.equipmentSmartStep. Real Inventory equip/replace and hand-icon removal, actual map clicks, server reload; test timeouts 120 s cover the twenty-step scenario. `grantLegacySmartStepToken(1…5)` uses the existing dev-only owned shield fixture because boots are disabled. Read-only hooks `getPaidSteps` and `findWorldStep` use the app's projection/engine enterability; tests never derive geometry. Assertions cover 20 steps → 16 Will for N=5, camp exclusion, bag exclusion, a free step at zero Will followed by refusal, swapping N=5→3 without reset, removal, reload, and consecutive free N=1 steps. Switch to the Hero tab before checking its Will label: the initial grant can leave Inventory open. Run with `sh scripts/pre-push-e2e.sh e2e/hero/equipment-smart-step.spec.ts --retries=0`.

## Equipment Wisdom (A05, 2026-11-20)

`hero/equipment-wisdom.spec.ts` uses EquipmentWisdomFeature / EquipmentWisdomComponent. Real Hall answers and real battle task option clicks verify persistent hero Will, bag exclusion, equip/removal, wrong answers, capacity and reload. Hall assertions allow its real 1/2 base award and require the additional Wisdom amount. `grantLegacyWisdomToken(1…5)` is an owned shield fixture while amulets remain disabled. `openBattleTask` uses the guarded dev-only saw-task fixture (real issueTask with server time), returns its correct index through the dev response, then the component clicks the actual option. No duplicated answer calculation, reward command or production projection leak. Battle Wisdom restores the persistent reserve; it never raises turnWill. Run through scripts/pre-push-e2e.sh, with 120 s scenario timeout.

Wisdom rename: canonical wisdom, legacy focus deprecated but still implemented for owned tokens, same reward stat/cap 5 and localized name. No focus generation profile. The obsolete Hall-only wisdom effect and hallWillReward reserve are removed. A06 is merged into A05, not another attribute to implement.

## Equipment Yield (A08, 2026-11-20)

`hero/equipment-yield.spec.ts` uses EquipmentYieldFeature / EquipmentYieldComponent. Normal factory-granted axe/pickaxe tokens (tier 1 +1 or tier 3 +2), exact-token Inventory drag, real USE and mouse wheel, real timed CUT/MINE, server reload including pending work. `getHarvest` is a read-only hook in harvest-hooks.ts exposing existing resource counters and pending bonuses; it does not grant resources. Tests verify bag exclusion, replacement/removal of the bonus, +1/+2 rewards with base quest progress, pending reload, and selection between two axes. Counters retain their existing session lifetime, so post-reload assertions measure the new session's gain; quests and equipped tokens persist. `isBattleEngaged` moved unchanged into battle-hooks.ts to keep createTestApi within its existing size limit. Run with scripts/pre-push-e2e.sh; 120 s timeout covers real mining duration.

## Equipment Trophy (A09, 2026-11-20)

`combat/equipment-trophy.spec.ts` uses EquipmentTrophyFeature / EquipmentTrophyComponent: normal factory +1 tier 1 / +2 tier 4 swords, exact-token equip, real Inventory USE + ATTACK, real grave READ and reload. Bag exclusion has a plain lethal sword. Start a lone-skeleton battle and wait for the board to settle before the guarded trophy-target fixture; it only positions a live enemy with 1 HP and gives the hero a turn, never kills or awards loot. getBattleTrophy exposes captured corpse bonuses and already-public collect items, never unopened containers or secret seeds. Run via scripts/pre-push-e2e.sh.

## Shield Heal on Block (2026-11-21)

`combat/heal-on-block.spec.ts` uses HealOnBlockFeature with normal factory shield tokens and real equip, a board tap to block the visible attacker or TAKE HIT, and reload. `prepareShieldStrike` invokes guarded shield-strike fixture: a living adjacent enemy spends its last strike Will through performAction, opening a real timed block window with one reachable attack side. The fixture never places shields or heals. Assertions use public battle HP; PostgreSQL integration verifies progress health and replay. Run with scripts/pre-push-e2e.sh and one worker to avoid overloading the user's Mac.

## Equipment Block sides (2026-11-21)

combat/equipment-block.spec.ts uses EquipmentBlockFeature: normal shield tokens, real equip and board taps, visible shield counter, over-cap attempt, pending-window reload, and same-type replacement. prepareShieldStrike(true) asks the dev-only fixture for six clear directions before the real incoming strike, then holdTheWindowOpen keeps the window available for UI assertions. This arranges terrain only; tests still place shields through actual clicks. Existing heal-on-block tests call the same hook without the optional flag. Run via pre-push script, one worker.

Block scaling coverage: the tier-4 +4 case grants a normal factory token, places five sides through real board taps, attempts a sixth and reloads. The sixth direction is the visible attacker hex from the public battle snapshot; free neighbours exclude occupied hexes.

Weapon critical coverage (2026-11-21): combat/equipment-crit.spec.ts uses EquipmentCritFeature / EquipmentCritComponent. Normal factory gear, real Inventory drag/USE and ATTACK, tooltip +2%/+10%/×N, actual health and event results, reload and same-type replacement. `prepareCritTarget` is dev-only: a living 30-HP unshielded target on flat ground, hero turn, and a strike sequence whose real seeded next roll is below 2%. It neither grants attributes nor forces a critical outcome or applies damage. A plain weapon still cannot crit. getLastBattleStrike reads existing public STRIKE_LANDED results only. Run via pre-push script, one worker/no retries. Tooltip attribute assertions filter the requested row because a token can have multiple attributes.

Heal-on-block wait regression (2026-11-21): real reaction completion must use WINDOW_RESOLVES_MS from src/config/battle-timing.ts, shared with BattleFlowFeature. The default expect timeout is 5 s, equal to the real block window, so it can expire before the server reply/projection arrives. Keep actual automatic closure and HP/reload assertions; do not substitute TAKE HIT, force expiry or retry the scenario to hide the race. The shared 20 s bound covers block/possible aim and server round trips without changing the game's 5 s window or the per-test timeout.

Deft Hands setup regression (2026-11-21): `giveHeroTheTurn` / `giveEnemyTheTurn` must clear a pending timed task in the dev-only engine fixture, alongside reactions and pending strikes. A previous enemy turn can leave a Saw task open; the real inventory hands gate then correctly refuses the potion drag with TASK_OPEN. EquipmentUseFeature waits for the board to settle and the ACT card after granting the turn, before dragging. Keep the real equip/use assertions and existing timeouts.

## Dimension lifecycle (D6, 2026-11-22)

`hero/dimensions.spec.ts` uses DimensionItemsFeature / CampingMapPage / DimensionItemsComponent. Normal factory GLOOM/SPARK bases and the authored ALIEN Last Verdict unique retain their entire token through real equipment drag, Earth/Underworld gate actions, reload and trader sale/buyback. Assert the complete stored token and visible dimension labels, not just the generic item key or family. `getInventoryToken(tokenId)` is a read-only owned-inventory hook; use exact token ids. `grantUniqueTokenItem` is guarded and uses the normal authored factory plus existing DEV_SET_INVENTORY fixture pipeline. Keep fixture seed independent of source id: source ids encode parts and the engine rejects seed disclosure. No Heaven location or new production unique drop rule is added.

Run with `sh scripts/pre-push-e2e.sh e2e/hero/dimensions.spec.ts --workers=1 --retries=0`. Final acquisition/portal verification also includes `hero/loot-chest.spec.ts`, `camp/return-portal.spec.ts` and `slow/hero/token-look.spec.ts` with E2E_INCLUDE_SLOW=1. Keep specs selector-free, locators in the component, public Feature methods wrapped in steps, and wait for active-board readiness/inventory settling before reload assertions. Read hooks may serialize owned reactive tokens; never use structuredClone directly on a Vue proxy.

Hero base crit (2026-11-23): every hero strike has a 5% base crit chance. `prepareCritTarget` chooses a real roll < 2%, so in `combat/equipment-crit.spec.ts` a plain weapon now crits ×2 (damage 4). Other combat specs check hero strike damage only by relation (`toBeLessThan`), never an exact value; keep it that way, or arrange the roll through a fixture.

Hero base crit override (2026-11-23, Oleh): when a combat spec's flow depends on who kills first, fix the base chance in that spec only with the server battle fixture `{ kind: 'hero-base-crit', heroBaseCrit: 0 }` (after the battle starts, before the hero strikes), never with an env variable. There is no web hook for it yet: add one to `battle-hooks.ts` (and a local type in `test-api.types.ts`, no engine import) when the first such spec appears. Audit 2026-11-23: no current spec needs it, because each strikes once, a crit (4) does not kill a fresh warrior (5) or king (13), and an archer (2) dies to a plain hit too.

- Hands (2026-11-24): `SwapHandsFeature` (`openCampHolding`, `dragToHand`, `verifyHands`, `swapInBattle`), `VerifyToolActionFeature.verifyToolShown(itemKey)` checks the sprite on the map tool hex; `EquipmentBlockFeature.start` and `EquipmentCritFeature.start` take an optional hand slot.
