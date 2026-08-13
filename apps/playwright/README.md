# @hexoflat/playwright

End-to-end tests driving `apps/web` (a real browser, real PixiJS canvas) against a real `apps/api` + Postgres. Playwright + a layered Page-Object-style framework + Allure reporting.

This doc is a practical guide: how to run the suite, how to debug a failing test, and how to add a new one. For the "why" behind the architecture, read the comments in `src/framework/base-component.ts` first — they're load-bearing, not decoration.

## Prerequisites

Same as the rest of the repo (see the [root README](../../README.md)):

- `pnpm install` from the repo root
- Postgres running (`docker compose -f docker-compose.dev.yml up -d` from the repo root)
- `apps/api` schema pushed and the server running:
  ```bash
  pnpm --filter @hexoflat/api db:push
  pnpm --filter @hexoflat/api start:dev
  ```

Playwright itself starts and stops `apps/web` for you (see [Building the app under test](#building-the-app-under-test-vite_e2e_hooks) below) — you don't need `pnpm run start:client` running separately, and having one already on port 5173 will actively get in the way (see [Troubleshooting](#troubleshooting)).

Install the browser binaries once:

```bash
pnpm --filter @hexoflat/playwright exec playwright install --with-deps chromium
```

## Running the suite

```bash
pnpm --filter @hexoflat/playwright run test:e2e            # headless
pnpm --filter @hexoflat/playwright run test:e2e:headed      # watch it click
pnpm --filter @hexoflat/playwright exec playwright test --ui  # Playwright's UI mode — best for iterating
```

Common filters (all standard Playwright CLI flags — nothing project-specific):

```bash
# one file
pnpm --filter @hexoflat/playwright exec playwright test e2e/world/hero-movement.spec.ts

# by title
pnpm --filter @hexoflat/playwright exec playwright test -g "starts with base 10 HP"

# open the last run's HTML report
pnpm --filter @hexoflat/playwright exec playwright show-report
```

`pnpm turbo run test:e2e` runs it the same way Turborepo/CI does.

## Architecture: four layers, one direction

```
e2e/*.spec.ts   → calls ONLY Feature classes.
                  Never sees `page`, a locator, or `expect` on a locator.
Feature         → orchestrates Page Objects into a business flow.
                  Owns no locators. Every public method wrapped in `this.step(...)`.
Page Object     → represents one route: goto / waitUntilReady / URL assertions.
                  Composes Components. Holds no locators.
Component       → owns the locators of ONE UI region.
                  The ONLY layer allowed to call getByTestId/getByRole/locator().
```

This isn't a convention you have to remember — it's enforced by ESLint (see [Guardrails](#guardrails-what-eslint-wont-let-you-do)). A spec that reaches for a locator, or calls `page.goto` directly, fails lint.

There's a second rule ESLint can't enforce, so it has to be enforced by review: **one Feature class = one verb.** A class name encodes an action (`MoveHeroFeature`, `VerifyHeroPositionFeature`, `OpenSettingsFeature`), and every public method on it must start with that same verb — `moveOneStep`, `moveAdjacentTo`; `verifyChanged`, `verifySurvivesReload`. See [Naming Features](#naming-features-one-verb-per-class) below before adding a method to an existing Feature or reaching for a new one.

```
apps/playwright/
├── e2e/                          # tests only — one directory per feature area
│   ├── auth/
│   ├── world/
│   └── i18n/
├── src/
│   ├── framework/                # base classes + the ambient `page` context
│   ├── components/                # *.component.ts — the only place with locators
│   ├── pages/                     # *.page.ts — one per route
│   ├── features/                  # *.feature.ts — business flows, grouped like e2e/
│   ├── fixtures/test.ts           # `import { test, expect } from '@fixtures'`
│   ├── api/register-user.ts       # direct API calls used by fixtures (not UI)
│   └── config/                    # env.ts, test-data.ts, allure.ts
├── global-setup.ts                # fails fast if apps/api isn't reachable
└── playwright.config.ts
```

### Why a spec ends up reading like this

```ts
import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { VerifyHeroPositionFeature } from '@features/world/verify-hero-position.feature';

test('Verify clicking an adjacent tile moves the hero there', async () => {
  await new OpenCampingMapFeature().open();

  const moveHero = new MoveHeroFeature();
  const positionBefore = await moveHero.readPosition();

  await moveHero.moveOneStep();

  await new VerifyHeroPositionFeature().verifyChanged(positionBefore);
});
```

No `page` in sight, no `{ page }` fixture destructuring. That works because Component/Page/Feature classes don't take `page` in their constructor — they read it off an ambient module-scoped variable (`src/framework/test-context.ts`), which an auto-fixture (`bindTestContext` in `src/fixtures/test.ts`) sets before the test body runs and clears after.

This is safe under `fullyParallel: true` specifically because a Playwright **worker is a separate OS process that runs exactly one test at a time** — parallelism buys more workers, never concurrent tests sharing one worker's module state. The one thing that _would_ break it — a hand-rolled `browser.newPage()` used concurrently inside a single test — is banned by the same ESLint pass that enforces the layers.

### Path aliases

Configured once in `tsconfig.json`, used everywhere:

| Alias           | Points to                                                   |
| --------------- | ----------------------------------------------------------- |
| `@framework/*`  | `src/framework/*`                                           |
| `@components/*` | `src/components/*`                                          |
| `@pages/*`      | `src/pages/*`                                               |
| `@features/*`   | `src/features/*`                                            |
| `@fixtures`     | `src/fixtures/test.ts`                                      |
| `@config/*`     | `src/config/*`                                              |
| `@api/*`        | `src/api/*`                                                 |
| `@web-test-api` | `apps/web/src/e2e/test-api.types.ts` (type-only, see below) |

## Driving the PixiJS board: `window.__HEXOFLAT_TEST__`

The board is a canvas — there's nothing in the DOM to query for tile positions, neighbours, or hex distance. Rather than re-implementing that geometry in the test suite (which drifted silently from the real engine math before this rewrite), `apps/web` exposes a small API on `window.__HEXOFLAT_TEST__` that answers those questions using its own engine code.

- **Contract**: `apps/web/src/e2e/test-api.types.ts` — a plain interface, zero imports. `src/config/test-data.ts` and `src/components/hex-board.component.ts` type-import it via the `@web-test-api` alias, so changing its shape breaks `pnpm --filter @hexoflat/playwright typecheck` here instead of silently breaking a test at runtime.
- **Implementation**: `apps/web/src/e2e/create-test-api.ts`, wired up from `hex-world-map.vue`.
- **Only present when `VITE_E2E_HOOKS=true`** — see the next section.

`src/components/hex-board.component.ts` is the only place that calls it (via `page.evaluate`). If you need a new fact from the board, add a method to `HexoflatTestApi` in `test-api.types.ts`, implement it in `create-test-api.ts`, then call it from the component — don't reach for `page.evaluate` anywhere else.

### Building the app under test (`VITE_E2E_HOOKS`)

`playwright.config.ts`'s `webServer` builds `apps/web` with `VITE_E2E_HOOKS=true` and serves that build:

```
VITE_E2E_HOOKS=true pnpm --filter @hexoflat/web run build && \
  pnpm --filter @hexoflat/web exec vite preview --port 5173 --strictPort
```

Without that flag, `installTestHooks()` is a no-op and the whole hook module tree-shakes out of the bundle — a normal `pnpm --filter @hexoflat/web run build` never ships `__HEXOFLAT_TEST__`. Verify it yourself after touching anything in `apps/web/src/e2e/`:

```bash
pnpm --filter @hexoflat/web run build
grep -r "__HEXOFLAT_TEST__" apps/web/dist || echo "OK: no test hooks in the production bundle"
```

Neither this grep nor `pnpm run size-limit` (root `package.json`, checks `apps/web`'s bundle-size budgets) runs in CI today — both are manual checks. Worth running by hand if you touch `apps/web/src/e2e/` or anything `hex-world-map.vue` imports from it.

## Fixtures & test users

`src/fixtures/test.ts` registers **one real user per Playwright worker** (not per test, not one global user) via a direct `POST /auth/register` call (`src/api/register-user.ts`) — no UI involved. That user's session cookie becomes the worker's default `storageState`, so most specs start already logged in.

- `workerTestUser` — the registered `{ username, password, name }`
- Specs that test the login/register/logout flow itself opt out with `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the file (see `e2e/auth/login.spec.ts`)

## Named map locations: `src/config/test-data.ts`

Don't hardcode hex coordinates in a spec or Feature. Add a name to `MapTokens` instead:

```ts
export const MapTokens = {
  starterAxe: { columnIndex: 7, rowIndex: 2 },
} as const satisfies Record<string, TestHexCoordinates>;
```

Features take a `MapToken`, not raw coordinates (`new TakeTokenFeature('starterAxe')`). When the map layout changes, exactly one line here changes instead of a grep-and-replace across specs.

## Naming Features: one verb per class

Every Feature class name is `{Verb}{Noun}Feature`, and **every public method on it starts with that same verb.** `MoveHeroFeature` only ever has `move*` methods; a `verify*` method never lives there, even if it feels convenient to bolt on. This makes the class name alone tell you what a Feature _does_ — no need to open the file to find out whether `moveHero.checkPosition(...)` mutates state or asserts on it.

- **Action Features** (`login`, `move`, `open`, `arm`, `take`, `record`, `burst`, `reload`, `logout`): the verb is the thing being done. `readPosition()` / `readStepsChipText()` are the one sanctioned exception — a `read*` getter that fetches state to drive the next assertion isn't an action or an assertion, so it's allowed to live alongside the action methods rather than needing its own class.
- **Verify Features** (`VerifyHeroPositionFeature`, `VerifySessionFeature`, `VerifyAuthApiFeature`, ...): every method is `verify*`, grouped by the _business entity_ being checked, not by which spec happens to call them. `VerifySessionFeature` covers cookie persistence _and_ the post-logout refresh check, because both are really "what does the session look like" — not because they're used from the same test. Before creating a new `Verify*Feature`, check whether an existing one already owns that entity.
- **Helpers that aren't business logic** (a private `readSessionCookie()` used only to build an assertion, per-instance state like `RecordSessionRequestsFeature`'s recorded statuses array) stay `private` inside whichever class needs them. Privacy is what keeps them out of the "does every public method match the verb" check — they're implementation detail, not part of the class's contract.

Concrete split from a single refactor, for calibration: `AuthApiFeature` (one class mixing `burstLogin` + `verifyEveryStatusIs` + `startRecordingSessionRequests` + `verifySessionRequestsAllSucceeded`) became four — `BurstLoginFeature.burst()`, `RecordSessionRequestsFeature.record()`/`.readStatuses()`, and `VerifyAuthApiFeature.verifyAllStatusesAre()`/`.verifyStatusCountEquals()` (the last one reused by both action classes). `GatherResourceFeature` (`armHandTool` + `take` + four `verify*` methods) became `UseHeroToolFeature.use()`, `VerifyInventoryFeature`, `VerifyMapTileFeature`, `VerifyToolActionFeature`, and `TakeTokenFeature.take()`.

An action Feature is also allowed — encouraged, even — to _compose other action Features_ internally when the thing it represents is one atomic real-world user action made of several lower-level steps. `TakeTokenFeature.take()` is the example: picking up an item means walking next to it and equipping the HAND tool first, so `take()` calls `MoveHeroFeature.moveAdjacentTo()` and `UseHeroToolFeature.use()` itself rather than making every spec re-sequence all three by hand. Both composed Features stay fully usable on their own; `take()` just spares a caller from restating "and obviously you have to walk there and equip the tool first" at every call site. The nested `this.step(...)` calls still show up as a step tree in the Allure report (see [Reporting](#reporting-allure)), so the composed steps stay visible — they just aren't the caller's problem to sequence.

A constructor argument is also how a Feature stays generic without exploding into one class per variant: `UseHeroToolFeature(tool: Tool)` (`src/config/hero-tool.ts`) mirrors the engine's `THeroToolKey` union as a proper enum, so `new UseHeroToolFeature(Tool.HAND).use()` reads as "use this specific tool" rather than a one-off `armHandTool()` that only ever meant HAND. Only `Tool.HAND` is actually reachable today — the class throws a clear error for the others rather than silently no-oping, since equipping AXE/PICKAXE/SWORD/SHIELD needs the inventory's drag-and-drop equip flow, which this suite doesn't drive yet.

## Adding a new test

Work top-down, one layer at a time:

1. **Component** (`src/components/*.component.ts`) — does a component already own the UI region you need? If not, create one extending `BaseComponent`. Locators are `private get`ters; public methods are either an action (`clickX`) or a `verify*` assertion built on a web-first `expect`.
2. **Page** (`src/pages/*.page.ts`) — does the route already have a Page Object? If not, create one extending `BasePage`, composing the Components that live on that route.
3. **Feature** (`src/features/<area>/*.feature.ts`) — write the business flow as a class extending `BaseFeature`, following [Naming Features](#naming-features-one-verb-per-class): one verb per class, action methods separate from `verify*` methods. Wrap every public method in `this.step('...', async () => { ... })` — this is what makes the Allure report and the video captions readable (see [Reporting](#reporting-allure) below).
4. **Spec** (`e2e/<area>/*.spec.ts`) — call Features. At least one `verify*` call should be visible directly in the test body — don't bury every assertion three files deep, a reviewer should be able to tell what's being checked without opening the Feature.

## Guardrails: what ESLint won't let you do

Enforced repo-wide in `eslint.config.js` (`E2E_TEST_FILES` / `E2E_FRAMEWORK_FILES` blocks):

- **`e2e/**`**: no `getByTestId`/`getByRole`/`.locator(...)`, no direct `page.*` access, no `waitForTimeout`, no importing from `@playwright/test` (use `@fixtures`).
- **Everywhere in this package**: `@typescript-eslint/no-floating-promises` is an error — a forgotten `await` on an assertion doesn't fail the test, it makes it silently, permanently green.

Run it directly:

```bash
pnpm --filter @hexoflat/playwright run lint
pnpm --filter @hexoflat/playwright typecheck
```

## Reporting (Allure)

Every run writes raw results to `allure-results/`; build the browsable HTML report with:

```bash
pnpm --filter @hexoflat/playwright run report:allure:generate   # needs a JVM — see below
pnpm --filter @hexoflat/playwright run report:allure:open
```

Reporting behaviour is configured once in `src/config/allure.ts`, never in a spec:

- **Environment info** (branch, commit, PR trigger, CI run, web/API URLs) — shown in the report's Environment widget. This matters because `ci.yml` republishes the report to one fixed GitHub Pages URL from every PR as well as from trunk, so the live report is constantly overwritten; without this you can't tell which run you're looking at.
- **Failure categories** — separate "the API wasn't running" / "the board never rendered" / "hero movement got stuck" from genuine product-behaviour failures, so a red run from broken infrastructure doesn't read as a game bug. If you add a new kind of infrastructure failure with a distinctive error message, add a pattern to `SPECIFIC_FAILURE_PATTERNS` in `allure.ts` rather than letting it fall into the catch-all "Product defect" bucket.
- **`test.step`** — every `BaseFeature.step(...)` call becomes a step in the Allure tree and, with `video.show.test.level: 'step'` (in `playwright.config.ts`), a caption burned onto the failure video. For a canvas game this is often the only way to see what a click was trying to do — which is why wrapping Feature methods in `this.step` isn't optional.

`allure generate` needs a JVM (Java 17+); CI has it via `setup-java`. If you don't have Java locally, use the plain Playwright HTML report instead (`playwright show-report`) — it needs no extra tooling and is generated on every run regardless.

## Debugging a failing test

- **Trace**: `trace: 'on-first-retry'` — CI retries twice, so a CI failure almost always has a trace. Open it with:
  ```bash
  pnpm --filter @hexoflat/playwright exec playwright show-trace test-results/<test-dir>/trace.zip
  ```
- **Video**: `retain-on-failure` — kept for every failure, locally too (not just on retry), with action/step captions burned in.
- **Screenshot**: `only-on-failure`, attached automatically.
- **UI mode** (best for local iteration): `pnpm --filter @hexoflat/playwright exec playwright test --ui`.

## CI

- `ci.yml` is one sequential pipeline: lint/typecheck/build/unit-tests/api-tests/db-migrations run in parallel, then the reusable `e2e-tests.yml` workflow runs once as the last gate (Postgres via a service container, `apps/api` built and started, then the suite), then the Allure HTML report is published to GitHub Pages (`/e2e-report/`) — on every PR as well as `main`/`game-dev-vite`, so a PR always has a live report link, and even when e2e fails (so the failure videos/screenshots are actually reachable). It used to be two separate workflows (`ci.yml` + `deploy.yml`) each triggering their own e2e run; merged 2026-08-12 because that doubled the most expensive job and caused runner queueing on every PR. See the comment at the top of `ci.yml` for the Pages trade-off that publishing on every PR implies (the game build on Pages briefly reflects whatever PR deployed last).
- `e2e-tests.yml` pulls the previous deployment's `allure-results/history/` before generating the report, which is what makes Allure's trend graphs (duration, retries, categories) non-empty from the second run onward.

## Troubleshooting

**`window.__HEXOFLAT_TEST__ is missing`** — almost always means something else is already serving port 5173 (e.g. you left `pnpm run start:client` running). `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so Playwright silently reuses whatever's already on that port instead of building its own — and a plain dev server was never built with `VITE_E2E_HOOKS=true`. Stop it (`pnpm run stop:all` from the repo root) and re-run. The error message itself repeats this.

**`apps/api is not reachable at .../health`** — `global-setup.ts` fails the whole run fast rather than letting every test time out individually. Start Postgres + the API (see [Prerequisites](#prerequisites)).

**A test hangs waiting for hero coordinates / board readiness** — check `apps/api`'s logs first; a 500 on `/auth/register` (e.g. Postgres not actually up yet, or `db:push` not run) surfaces here as a timeout, not as the real error, because it happens inside a worker fixture rather than the test body.

**Flaky locally that's green on CI, or vice versa** — CI runs 2 retries and up to `maxFailures: 10`; locally both are off (`retries: 0`, `workers` unset) specifically so flakiness is visible immediately instead of quietly retried away. Don't add local retries to make red go away — find out why it's red.
