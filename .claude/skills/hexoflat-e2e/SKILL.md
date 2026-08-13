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

Keep the `import.meta.env.VITE_E2E_HOOKS !== 'true'` guard **inline** at its call sites so Vite statically drops the hooks from production bundles.

## Flakiness: the trap that already bit this project

`expect.poll()` can pass on a **stale value before a debounce settles it to the buggy one**. A test that polls a value which is written twice — once optimistically, once after a debounce — can go green on the first write and never observe the second.

When asserting on anything debounced or delayed (saves are debounced ~750ms), assert on the settled state, and make sure the condition could not have been satisfied by the pre-debounce value.

Prefer web-first assertions and real conditions (`toHaveAttribute`, `expect.poll` on an app-reported value) over any sleeping.

Waiting for the board specifically: the canvas exposes `data-ready` once `onBoardReady` has fired. Use that, not `onMounted` timing or a fixed wait.

## Running

E2E runs in CI after lint/typecheck/build/unit-tests pass, and publishes an Allure report with trend history to GitHub Pages on every PR and trunk push.

## Checklist before finishing

- [ ] Spec calls only Feature methods — no locators, no `page`, no `waitForTimeout`
- [ ] New locators live in a Component; no Component returns a Locator
- [ ] No engine logic recomputed in test code — asked of `window.__HEXOFLAT_TEST__`
- [ ] Assertions on debounced state cannot pass on the pre-debounce value
- [ ] New Feature methods wrapped in `this.step`
