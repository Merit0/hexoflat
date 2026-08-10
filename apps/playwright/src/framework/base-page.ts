import type { Page } from '@playwright/test';
import { getCurrentPage } from '@framework/test-context';

/**
 * A Page Object represents one route of the app. It may navigate
 * (`page.goto`/`page.reload`) and assert on the URL, and it composes the
 * Components that live on that route — but it never declares a locator of
 * its own. See base-component.ts for the full layer contract.
 */
export abstract class BasePage {
  protected get page(): Page {
    return getCurrentPage();
  }
}
