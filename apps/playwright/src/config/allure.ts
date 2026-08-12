// Typed against allure-js-commons' public `sdk/reporter` subpath rather than
// allure-playwright's own config type: the latter lives behind that package's
// `exports` map and is not importable. The Playwright-specific extras
// (`detail`, `suiteTitle`) are the only difference, and we don't set them.
import type { ReporterConfig } from 'allure-js-commons/sdk/reporter';
import type { Category, EnvironmentInfo } from 'allure-js-commons/sdk';
import { Status } from 'allure-js-commons';
import { API_URL, WEB_URL } from '@config/env';

/**
 * Allure reporter configuration.
 *
 * Everything here is declarative and lives in the config on purpose — the
 * specs stay free of reporting concerns. See src/framework/base-feature.ts
 * for the other half of the story: `test.step` titles, which allure-playwright
 * maps straight into Allure's step tree.
 */

/**
 * Shown in the report's Environment widget.
 *
 * This matters more than it looks: ci.yml publishes the report to one
 * fixed Pages URL from every PR as well as from the trunk branches, so the
 * live report is constantly overwritten. Without these fields there is no way
 * to tell, from the report alone, which commit or PR you are looking at.
 */
function environmentInfo(): EnvironmentInfo {
  const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

  return {
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local',
    commit: (process.env.GITHUB_SHA ?? 'local').slice(0, 8),
    trigger: isPullRequest ? 'pull_request' : (process.env.GITHUB_EVENT_NAME ?? 'local'),
    ci_run: process.env.GITHUB_RUN_ID ?? '—',
    web_url: WEB_URL,
    api_url: API_URL,
  };
}

/**
 * Failure triage. Without these every red run lands in Allure's generic
 * "Product defects" bucket, so a run that went red because the API was down
 * reads exactly like a genuine game bug.
 *
 * These definitions are also what makes the `categories-trend.json` that
 * e2e-tests.yml restores from the previous deployment mean anything — with no
 * categories.json, that trend is permanently empty.
 *
 * Each regex is anchored on an error message this suite actually produces —
 * grep the quoted fragments and you will land on the code that throws them.
 */

/**
 * The message fragments each specific category keys off, kept as bare
 * alternations so the catch-all below can be composed from the same source.
 * Allure lets one result land in several categories at once, so a hand-written
 * catch-all would double-count every environment failure as a product defect
 * too — precisely the confusion this list exists to remove.
 */
const SPECIFIC_FAILURE_PATTERNS = {
  missingHooks: '__HEXOFLAT_TEST__ is missing',
  apiUnreachable: 'apps/api is not reachable',
  boardNotInteractive:
    'data-ready|has no bounding box|no coordinates on the board|before the board had a real size',
  movementBlocked: 'could not step onto|no forward neighbour|Did not reach a tile adjacent',
} as const;

/**
 * `[\s\S]` rather than `.`: allure-commandline is Java and matches the *whole*
 * message with `.` not spanning newlines by default, while these messages are
 * all multi-line.
 */
function containing(pattern: string): string {
  return `[\\s\\S]*(${pattern})[\\s\\S]*`;
}

/** Full message match that excludes everything the specific categories claim. */
function anythingElse(): string {
  const claimed = Object.values(SPECIFIC_FAILURE_PATTERNS).join('|');
  return `(?![\\s\\S]*(${claimed}))[\\s\\S]*`;
}

const categories: Category[] = [
  {
    name: 'Environment: e2e hooks missing',
    description:
      'The app under test was served without VITE_E2E_HOOKS=true — usually a stray dev server ' +
      'already holding port 5173. Not a product defect.',
    messageRegex: containing(SPECIFIC_FAILURE_PATTERNS.missingHooks),
    matchedStatuses: [Status.FAILED, Status.BROKEN],
  },
  {
    name: 'Environment: apps/api unreachable',
    description:
      'Postgres or apps/api was not running when the suite started (see global-setup.ts). ' +
      'Not a product defect.',
    messageRegex: containing(SPECIFIC_FAILURE_PATTERNS.apiUnreachable),
    matchedStatuses: [Status.FAILED, Status.BROKEN],
  },
  {
    name: 'Board never became interactive',
    description:
      'The PixiJS board did not reach a usable state: no first frame, no canvas box, or the ' +
      'world never placed the hero.',
    messageRegex: containing(SPECIFIC_FAILURE_PATTERNS.boardNotInteractive),
    matchedStatuses: [Status.FAILED, Status.BROKEN],
  },
  {
    name: 'Hero movement blocked',
    description:
      'Pathing on the camping map failed. Either map content moved (see src/config/test-data.ts) ' +
      'or tile clicks stopped registering on the canvas.',
    messageRegex: containing(SPECIFIC_FAILURE_PATTERNS.movementBlocked),
    matchedStatuses: [Status.FAILED],
  },
  {
    name: 'Product defect',
    description:
      'A genuine assertion failure about game or auth behaviour — everything the categories ' +
      'above did not claim.',
    messageRegex: anythingElse(),
    matchedStatuses: [Status.FAILED],
  },
];

export const allureReporterOptions: ReporterConfig = {
  resultsDir: 'allure-results',
  environmentInfo: environmentInfo(),
  categories,
  globalLabels: { layer: 'e2e' },
};
