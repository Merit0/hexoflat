import { test, type APIRequestContext, type Page } from '@playwright/test';
import { getCurrentPage, getCurrentRequest } from '@framework/test-context';

/**
 * A Feature is one business flow ("log in", "gather a resource"), assembled
 * out of Page Objects. It owns no locators — see base-component.ts for the
 * full layer contract.
 */
export abstract class BaseFeature {
  protected get page(): Page {
    return getCurrentPage();
  }

  protected get request(): APIRequestContext {
    return getCurrentRequest();
  }

  /**
   * Wraps an action in `test.step`, which is what turns a flat action log
   * into a readable tree in the HTML/Allure report and in the trace viewer —
   * and, with `video.show.test.level: 'step'` (see playwright.config.ts),
   * prints the step title straight onto the recorded video. For a canvas
   * game that video caption is often the only way to tell *what* a click was
   * trying to do.
   *
   * Every public Feature method should be wrapped in this.
   */
  protected step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return test.step(title, body);
  }
}
