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

## Current status vs. target

**Phases 1–10 of the migration are done** (monorepo + Turborepo, `packages/engine` extracted with zero Vue/browser/Nest/DB dependencies, engine unit tests, PixiJS renderer, `apps/api` on NestJS + Fastify, PostgreSQL + Drizzle, TanStack Query in `apps/web`, WebSocket multiplayer sync for movement/resource-gathering, custom JWT auth, Playwright e2e). Beyond the original plan, the repo has also been through a security/SOLID hardening pass (JWT fail-fast in production, rate limiting, campaign-scoped ACL on saves/scenarios, periodic scenario autosave, data-driven heal content, split `world-map-store`) and the CI workflow now runs lint/typecheck/build/unit-tests/api-tests/e2e as separate jobs.

**Phases 11–12 are deliberately paused** (containerized production deploy for `apps/api`; S3 assets + OpenTelemetry/Sentry) — local dev is already fully covered by `docker-compose.dev.yml`, and there's no real player/business need yet to justify production hosting or observability. Revisit only when that need shows up.

**One standing exception to architecture Rule #1:** combat still lives entirely in `apps/web/src/stores/combat-store.ts` — state changes there do not go through `packages/engine`'s command/event pipeline. This is a deliberate, tracked gap, not an oversight: combat design itself isn't settled yet, so migrating it into the engine (and scoping multiplayer sync around it) is deferred until the game design is ready, not until there's engineering time.

See [`docs/MIGRATION-PLAN.md`](./docs/MIGRATION-PLAN.md) for the phase-by-phase breakdown, acceptance criteria, and the pause notes on Phases 11–12.

## Design research

[`docs/design/gloomhaven-frosthaven-scout-report.md`](./docs/design/gloomhaven-frosthaven-scout-report.md) (2026-07-24) is a scout report on Gloomhaven/Frosthaven mechanics, UX, and player/community feedback — what to keep as a principle, what to avoid copying, and concrete UX patterns (intent → preview → confirm → explained result, rule trace, AI intent overlay, complexity budgets, drop-in/drop-out multiplayer model). It's design inspiration, not a spec, and must not be a source of copied names/text/art/balance (see the IP constraint above). Consult it before designing new mechanics, cards, scenarios, or campaign/meta systems — especially before tackling the combat design gap noted above, since that report's "Phase 1 — Combat vertical slice" is exactly that unresolved piece.

[`docs/design/tactical-coop-dungeon-crawler-scout-report.md`](./docs/design/tactical-coop-dungeon-crawler-scout-report.md) (2026-08-05) broadens the research beyond one game family: 15+ top coop/solo tactical dungeon crawlers (Descent, Massive Darkness 2, Kingdom Death: Monster, Too Many Bones, Tainted Grail, Middara, Sword & Sorcery, Mansions of Madness, Zombicide, Imperial Assault, Arkham Horror LCG, Sleeping Gods, D&D Adventure System, and others), broken down by hero movement, combat/initiative/AI, crafting/itemization, dungeon/exploration generation, skill trees/hero progression, and quest/campaign/journey structure. Section 10 synthesizes a proposed original Hexoflat model combining elements from ≥2 independent sources per subsystem — same rule applies: design inspiration only, never copy names/text/art/exact formulas.

Add future scout/research docs to `docs/design/` and reference them here.

## Workflow rules

- Always ask before `git commit` — not just before `git push`.
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build on every PR (any target branch) and on push to `main`. `deploy.yml` runs the same checks again and deploys `apps/web` to GitHub Pages on push to `main`.
