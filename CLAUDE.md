# hexoflat

Original cooperative tactical fantasy game: turn-based combat on a hex-grid map, card-based character abilities, progression, scenarios, persistent campaign.

Inspired by general tactical dungeon-crawler concepts (including Frosthaven), but must not copy its names, characters, story, texts, artwork, terminology, balance, or other protected content. All mechanics, worldbuilding, classes, enemies, abilities, scenarios, and visual assets must be original.

## Target stack

- Monorepo: pnpm workspaces + Turborepo
- Frontend (`apps/web`): Vue 3 + TypeScript + Vite
- UI state: Pinia
- Server state: TanStack Query
- Board renderer: PixiJS
- Game engine: `packages/engine` — pure TypeScript, zero dependency on Vue, browser APIs, NestJS, or the database
- Backend (`apps/api`): NestJS + Fastify adapter
- API: REST + WebSocket
- Database: PostgreSQL
- ORM: **Drizzle** (decided 2026-07-29 — TS/SQL-first, fits the Zod-heavy style already in the repo; not Prisma)
- Validation: Zod
- Auth: **custom lightweight JWT auth in NestJS** (decided 2026-07-29 — not Keycloak/Auth0, revisit only if the project goes multi-org/enterprise)
- Asset storage: S3-compatible
- Testing: Vitest (unit) + **Playwright** (e2e, decided 2026-07-29 — not Cypress; better fit for multi-tab/WebSocket drop-in/drop-out co-op scenarios)
- Deployment: Docker (`apps/api`), GitHub Pages (`apps/web` static build)
- Observability: OpenTelemetry + Sentry

## Non-negotiable architecture rules

1. All game-state changes happen through validated commands (Zod) and produce domain events. No mutating game state outside this pipeline.
2. `packages/engine` must stay importable with zero Vue/browser/Nest/DB dependencies. If a change to engine code requires one of those, it belongs in `apps/web` or `apps/api` instead.
3. Content (heroes, ability cards, enemies, items, statuses, maps, scenarios) is data-driven, validated with Zod, versioned, and kept separate from runtime game state.
4. Architecture must support single-player and drop-in/drop-out co-op: joining an active scenario, transferring control of an existing hero, reconnecting, state sync, snapshots, save/load, replay.
5. Shared game state and components across desktop/tablet/mobile, with platform-specific layouts/interactions layered on top — not forked implementations.
6. E2E-тести шарові й селектор-вільні. `apps/playwright/e2e/**` викликає **тільки** Feature-класи:
   ніяких локаторів, ніякого `page`, ніякого `waitForTimeout` (це enforced ESLint-ом, не
   домовленістю). Локатори живуть виключно в `src/components/*.component.ts`. Стан гри та
   геометрію гексів тести питають у застосунку через `window.__HEXOFLAT_TEST__`
   (`apps/web/src/e2e/`, вмикається `VITE_E2E_HOOKS=true` тільки в e2e-збірці) — жодного
   дублювання логіки `packages/engine` у тестовому коді. Деталі й «чому» —
   `apps/playwright/README.md` і коментарі в `src/framework/base-component.ts`.

## Current status vs. target

**Phases 1–10 of the migration are done** (monorepo + Turborepo, `packages/engine` extracted with zero Vue/browser/Nest/DB dependencies, engine unit tests, PixiJS renderer, `apps/api` on NestJS + Fastify, PostgreSQL + Drizzle, TanStack Query in `apps/web`, WebSocket multiplayer sync for movement/resource-gathering, custom JWT auth, Playwright e2e). Beyond the original plan, the repo has also been through a security/SOLID hardening pass (JWT fail-fast in production, rate limiting, campaign-scoped ACL on saves/scenarios, periodic scenario autosave, data-driven heal content, split `world-map-store`) and the CI workflow now runs lint/typecheck/build/unit-tests/api-tests/e2e as separate jobs. E2E now also publishes an Allure report with trend history to GitHub Pages from every PR and trunk push — this deliberately overwrites the root Pages site each deploy (see the trade-off comment at the top of `.github/workflows/ci.yml`).

**The God Class refactor (`docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md`, phases G0–G6) is done.** `world-map-store.ts`, `combat-store.ts`'s pure logic, and `hero-inventory-store.ts` are split into focused engine modules, persistence services, and composables. ESLint now enforces the result instead of relying on review: `max-lines`/`max-lines-per-function`/`complexity`/`max-depth` in `apps/web/src` and `packages/engine/src` are ratcheted to the current measured maximums (`eslint.config.js`), `import-x/no-cycle` is `error` everywhere except the 7 files in `KNOWN_CYCLE_FILES` (pre-existing, reviewed cycles — mainly Pinia's `use*Store()`-at-module-scope pattern), and `no-restricted-syntax` bans direct `localStorage`/`Math.random()` in `world-map-store.ts`, `hero-inventory-store.ts`, `combat-store.ts` specifically (not `stores/**` broadly — `hero-store.ts`, `user-store.ts`, `ui-settings-store.ts`, `game-events-store.ts` were never migrated off them and still use them directly by design).

**Phases 11–12 are deliberately paused** (containerized production deploy for `apps/api`; S3 assets + OpenTelemetry/Sentry) — local dev is already fully covered by `docker-compose.dev.yml`, and there's no real player/business need yet to justify production hosting or observability. Revisit only when that need shows up.

**One standing exception to architecture Rule #1:** combat still lives entirely in `apps/web/src/stores/combat-store.ts` — state changes there do not go through `packages/engine`'s command/event pipeline. This is a deliberate, tracked gap, not an oversight: combat design itself isn't settled yet, so migrating it into the engine (and scoping multiplayer sync around it) is deferred until the game design is ready, not until there's engineering time.

See [`docs/MIGRATION-PLAN.md`](./docs/MIGRATION-PLAN.md) for the phase-by-phase breakdown, acceptance criteria, and the pause notes on Phases 11–12.

**Next up — gameplay content, not infra:** [`docs/EXPLORATION-SLICE-WORKFLOW.md`](./docs/EXPLORATION-SLICE-WORKFLOW.md) is the execution plan for the next chapter of work — the Exploration Vertical Slice (phases E0–E9), built on the frozen design in [`docs/design/exploration-v0.1/`](./docs/design/exploration-v0.1/). It **supersedes** `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md` (that file is kept as decision history; its Phase A0 seeded-RNG work is pulled into E0, and its Part 1 design principles remain in force). Each phase is scoped to be its own standalone chat — start a fresh conversation per phase using that phase's "старт чату" prompt block, don't mix phases in one conversation. Section 3 of the workflow records seven concrete conflicts between the frozen design docs and this repo (axial vs odd-q coordinates, boolean `isRevealed` vs four-state discovery, missing command idempotency, the combat-outside-the-engine exception, the Scout ladder, co-op scope, `O(n)` tile lookup) — read it before touching any exploration code.

## Design research

[`docs/design/gloomhaven-frosthaven-scout-report.md`](./docs/design/gloomhaven-frosthaven-scout-report.md) (2026-07-24) is a scout report on Gloomhaven/Frosthaven mechanics, UX, and player/community feedback — what to keep as a principle, what to avoid copying, and concrete UX patterns (intent → preview → confirm → explained result, rule trace, AI intent overlay, complexity budgets, drop-in/drop-out multiplayer model). It's design inspiration, not a spec, and must not be a source of copied names/text/art/balance (see the IP constraint above). Consult it before designing new mechanics, cards, scenarios, or campaign/meta systems — especially before tackling the combat design gap noted above, since that report's "Phase 1 — Combat vertical slice" is exactly that unresolved piece.

[`docs/design/tactical-coop-dungeon-crawler-scout-report.md`](./docs/design/tactical-coop-dungeon-crawler-scout-report.md) (2026-08-05) broadens the research beyond one game family: 15+ top coop/solo tactical dungeon crawlers (Descent, Massive Darkness 2, Kingdom Death: Monster, Too Many Bones, Tainted Grail, Middara, Sword & Sorcery, Mansions of Madness, Zombicide, Imperial Assault, Arkham Horror LCG, Sleeping Gods, D&D Adventure System, and others), broken down by hero movement, combat/initiative/AI, crafting/itemization, dungeon/exploration generation, skill trees/hero progression, and quest/campaign/journey structure. Section 10 synthesizes a proposed original Hexoflat model combining elements from ≥2 independent sources per subsystem — same rule applies: design inspiration only, never copy names/text/art/exact formulas.

Add future scout/research docs to `docs/design/` and reference them here.

## Workflow rules

- Always ask before `git commit` — not just before `git push`.
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build (parallel), then e2e (gated behind all of those passing), then deploys `apps/web` + the Allure report to GitHub Pages — one sequential pipeline, on every PR (any target branch) and on push to `main`/`game-dev-vite`. It used to be two separate workflows that each ran their own e2e job; merged 2026-08-12 because that duplicated the most expensive job and caused runner queueing on every PR.
