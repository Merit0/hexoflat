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

The repo is currently a **frontend-only prototype**: Vue 3 + Vite + Pinia + Zod exist and match target. Everything else is a gap — DOM/CSS renders the hex map (no PixiJS), there is no backend/DB/ORM/auth (login checks a plaintext `public/users.json`), no monorepo/Turborepo, almost no tests (`src/content/content.test.ts` is the only one), no Docker, no TanStack Query, no S3, no observability.

The sequenced plan to close this gap lives in [`docs/MIGRATION-PLAN.md`](./docs/MIGRATION-PLAN.md). Follow it in order — later phases assume earlier ones are done (e.g. the PixiJS renderer swap assumes the engine has already been extracted into `packages/engine`, so the render layer isn't rewritten twice).

## Workflow rules

- Always ask before `git commit` — not just before `git push`.
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build on every PR (any target branch) and on push to `main`. `deploy.yml` runs the same checks again and deploys `apps/web` to GitHub Pages on push to `main`.
