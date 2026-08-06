import { test, expect } from '@playwright/test';
import { gotoCampingMap, waitForCampingMapReady } from '../support/login';
import { getHeroCoordinates, moveHeroOneStep } from '../support/hex-board';

test('Verify clicking an adjacent tile moves the hero there', async ({ page }) => {
  await gotoCampingMap(page);

  const before = await getHeroCoordinates(page);
  const stepsBefore = await page.getByTestId('topbar-steps-chip').innerText();

  const after = await moveHeroOneStep(page);

  expect(after).not.toEqual(before);
  await expect(page.getByTestId('topbar-steps-chip')).not.toHaveText(stepsBefore);
});

test('Verify Hero saves map placement after movement on reload page', async ({ page }) => {
  await gotoCampingMap(page);

  const before = await getHeroCoordinates(page);

  // 3 steps, not 1 — a single step off the map's entry point can land back
  // on one of the (at most 1-2) tiles placeHeroAtEntry() would also pick,
  // which let this test pass even while restoreSession() was silently
  // resetting the hero to the entry point on every reload (see
  // user-store.ts's applyAuthResult — restoreSession() used to run through
  // the same clearSessionStorage() call login()/register() use, wiping the
  // very localStorage['hero'] key the moved position lives under). 3 steps
  // away makes that coincidence practically impossible.
  let after = before;
  for (let i = 0; i < 3; i += 1) {
    after = await moveHeroOneStep(page);
  }
  expect(after).not.toEqual(before);

  // world-map-store.ts debounces its localStorage save by 750ms (see
  // support/hex-board.ts's waitForHeroPlaced) — wait for the moved position
  // to actually land in storage before reloading, so this proves the save
  // itself survives a reload rather than just getting lucky with
  // beforeunload's best-effort flush racing the new page's boot.
  await expect.poll(() => getHeroCoordinates(page)).toEqual(after);

  await page.reload();
  await waitForCampingMapReady(page);

  // bootstrapWorld() re-saves whatever it placed the hero at on every boot,
  // and *that* save is debounced by the same 750ms too — so storage still
  // reads the correct pre-reload value for a beat even on a boot that just
  // placed the hero somewhere wrong, simply because the wrong write hasn't
  // landed yet. `expect.poll` stops at the first match, so it's the wrong
  // tool here: it would pass by catching exactly that stale-but-still-
  // correct window, without ever seeing the wrong value that lands moments
  // later. A single check after clearing the debounce window is what
  // actually observes the *settled* state instead of a transient one.
  await page.waitForTimeout(1_000);
  expect(await getHeroCoordinates(page)).toEqual(after);
});
