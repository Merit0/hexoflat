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

State that the real game cannot reach cheaply is granted through hooks, not by clicking: `setWill(n)`, `prepareKnowledgeWorld(n)`, `setSkillRank(skillId, rank)` (skills priced above Will capacity, e.g. the Teleport skill), `placeHexobjectNextToHero(key)` (any hexobject by key on a free hex next to the hero: a squad token in camp, since reaching one in the generated cave is random, queried with `isBattleEngaged`; or a loose item to pick up), `finishBattle('victory' | 'defeat')` (ends the open battle so a spec can test leaving it), `giveHeroTheTurn()`, `giveEnemyTheTurn()` (an enemy two hexes from the hero), `crowdTheHero()` (two enemies beside the hero), `getBattleSnapshot()` (order, draws, reaction stage, creatures with hp/position, wounds, hero distances, aim options, revealed shields), `getBattleHexPoint(q, r)` (canvas point of a battle hex for hover/tap), `crowdTheHero(adjacent, far)`, `holdTheWindowOpen(ms)` (keeps the 5 s block window open for slow taps), `giveHeroTheTurn(will)`, `findTilesWithKey` / `countExistingNeighbours` (border checks) and `getBattleHands()` (all in `apps/web/src/e2e/battle-hooks.ts`; since D4b-4 B5 the battle is server-held, so the state-changing battle hooks are async and call `POST /player/dev/battle-fixture` (engine `battle/battle-fixtures.ts`), which only works when the API runs with `HEXOFLAT_E2E_FIXTURES=1`; `getBattleSnapshot().wounds` is always empty; battle specs live in `e2e/combat/battle-flow.spec.ts` through `BattleFlowFeature`, the block window is closed by the 5 s timer or TAKE HIT, and a battle starts straight from ATTACK; page exceptions are collected by `PageErrorsComponent`). Add a hook in `create-test-api.ts` + `test-api.types.ts` instead of writing helper logic in a test.

Keep the `import.meta.env.VITE_E2E_HOOKS !== 'true'` guard **inline** at its call sites so Vite statically drops the hooks from production bundles.

## Flakiness: the trap that already bit this project

`expect.poll()` can pass on a **stale value before a debounce settles it to the buggy one**. A test that polls a value which is written twice — once optimistically, once after a debounce — can go green on the first write and never observe the second.

When asserting on anything debounced or delayed (saves are debounced ~750ms), assert on the settled state, and make sure the condition could not have been satisfied by the pre-debounce value.

Prefer web-first assertions and real conditions (`toHaveAttribute`, `expect.poll` on an app-reported value) over any sleeping.

Waiting for the board specifically: the canvas exposes `data-ready` once `onBoardReady` has fired. Use that, not `onMounted` timing or a fixed wait.

## Running

Run a subset with `sh scripts/pre-push-e2e.sh e2e/<group>/<spec>.spec.ts` (own ports 3101/5273; it starts Postgres only if it was not running and stops only what it started). Rebuild `packages/engine` first if engine code changed.

### Groups and tags

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

## Shop hooks (SH3, 2026-11-10)

- `apps/web/src/e2e/shop-hooks.ts` (spread into `createTestApi`): `getTrader(key = 'ilva')` returns `{ key, serial, trips, goods, buyback, refreshPrice }` read from the served projection, `getOpenTrader()` the key of the open shop board or `null`, `getWalletCoins()` coins in the bag plus the hands (engine `walletCoins`), and `setTrader({ goods?, buyback?, trips? })` which first waits for `settleInventorySync()`, then posts `/player/dev/trader-fixture` with `X-Player-Session` and applies the returned `aggregates.progress`. The API must run with `HEXOFLAT_E2E_FIXTURES=1`. Goods are never rolled in the page: arrange them with `setTrader`, give coins with `grantInventoryItem`.
- The trader is served only to a hero beside the stall: walk there for real (`MoveHeroFeature.moveAdjacentTo`) and OPEN it with the hand, as the stash specs do.

## Shop specs (SH6, 2026-11-11)

- `e2e/hero/shop.spec.ts` (`@hero`, 42 tests) goes through `OpenShopFeature` (`open` = real walk + OPEN with the hand, `openAfterReload`, `close`, `pressEscape`, `walkAwayFromTheStall`, `verifyIsOpen/Closed`) and `ShopBoardFeature` (`givenGoods/givenTrader/givenBag/givenWill`, buying by drag to a bag cell or the bag panel, Shift half, double click, Enter, selling by drag onto the trader/goods panel, right click, buyback, New goods, and the `verify*` readers). Locators live only in `ShopBoardComponent` (`shop-board.component.ts`, on `CampingMapPage.shopBoard`); the real pointer drag is the shared `components/pointer-drag.ts` (`pointerDrag(page, source, target, { shift, release })`), the stash component keeps its own copy.
- Test ids: `shop-board`, `shop-close`, `shop-trader-banner|-name`, `shop-coins` (`data-coins`), `shop-sell-rate`, `shop-goods-pane`, `shop-goods-cell-<i>` / `shop-buyback-cell-<i>` (`data-item-key`, `data-item-amount`, `data-price`), `shop-price-<i>` (`data-price`, `data-affordable`), `shop-buyback-pane` (absent while BUYBACK is empty), `shop-refresh` (`data-affordable`, `data-confirm`), `shop-refresh-price` (`data-price`), `shop-drag-badge` (`data-label` = drop kind, e.g. `cantAfford`), `shop-hint`, `shop-selection` (`data-list`, `data-item-key`), `shop-selection-name|-amount|-price` (`data-price`, `data-affordable`), `shop-buy` (a clicked cell also has `data-selected`). GOODS has 8 cells (`TRADER_GOODS_SLOTS`), BUYBACK 7. The BAG is the stash's own pane: `stash-bag-cell-<i>`, `stash-load-value` as the "drop on the bag" point.
- Oracles: prices and sale values are constants in `src/config/test-data.ts` (`CoinPrices`, `SellValues`, `GUARANTEED_GOOD`, `REFRESH_BASE_WILL`) copied from the approved plan, never read back from the app; state is read through `getTrader`, `getWalletCoins`, `getBag`, `getKnowledge` and arranged with `setTrader` (goods, buyback, `trips`), `setBag` (coins are an ordinary bag item), `setWill` + `settleInventorySync`. Boundary tests: exactly the price (40 coins for a 40-coin shield) vs one coin short, 19 vs 20 Will, 40 Will for the second refresh.
- Walking away: `MoveHeroFeature.stepAwayFrom(token)` / `HexBoardComponent.stepAwayFrom` clicks only FREE neighbours, farthest from the object first (`moveOneStep` clicks the stall hex itself first, and the working tool hex lies over it). This spec found a real bug: `heroStore.moveHeroTo` closed the stash but not the shop, so a step with the shop open was silently ignored (the hand stayed "dragging"). Fixed by `services/hero-movement/close-boards-for-walk.ts`; unit test `composables/shop-walk.integration.test.ts` (no mocks, mirror of `stash-walk`).
- Not in e2e: a battle opening while the stall is open. The hand is busy on the stall, so the tool hex cannot be aimed at a squad (no ATTACK button); it is covered by `use-shop-session.test.ts` (`battle.inBattle` closes the board) and the API test `BATTLE_OPEN` in `shop.integration.spec.ts`.
- Touch: the drag is pointer-event based and `board-cell.css` sets `touch-action: none` on every cell, so the same code path serves a finger. Playwright's `touchscreen` can only tap, so a touch drag is not automated; real-device check is deferred (the hex tooltip touch is postponed as well).

## Cleaning test users

Each worker registers an `e2e-…` user per run and nothing deletes them. `pnpm --filter @hexoflat/api e2e-cleanup` deletes them (heroes, expeditions, journal cascade): default is users older than 24 h, `--older-than-hours N`, `--all`, `--dry-run`. It is refused in production.
