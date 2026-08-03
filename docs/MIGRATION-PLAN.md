# Migration plan: prototype → target stack

See [`CLAUDE.md`](../CLAUDE.md) for the target stack and non-negotiable architecture rules. This doc is the execution order — do the phases in sequence, don't skip ahead. Each phase lists its goal, concrete deliverables, commands, and acceptance criteria. Do not start a phase until the previous one's acceptance criteria are met.

Ask before `git commit` at every phase boundary (standing rule).

---

## Phase 1 — Monorepo scaffold (pnpm workspaces + Turborepo)

**Goal:** restructure the repo into a monorepo without changing any app behavior.

**Do:**

- `git mv` the current app's source into `apps/web/` (keep `src/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig*.json` together under `apps/web/`).
- Root `package.json` becomes the workspace root: add `turbo` as a devDependency, keep `packageManager: pnpm@11.17.0`.
- `pnpm-workspace.yaml`: add `packages: ['apps/*', 'packages/*']` (keep existing `allowBuilds`).
- Add `turbo.json` with pipeline tasks: `build`, `lint`, `typecheck`, `test`, `dev` (dev not cached, others cached with correct `dependsOn`/`outputs`).
- `apps/web/package.json` keeps its own scripts (`dev`, `build`, `lint`, `typecheck`, `test`, etc.) — same as today, just scoped to the package.
- Root `package.json` scripts become `turbo run <task>` wrappers (e.g. `"build": "turbo run build"`).
- Update `.github/workflows/ci.yml` and `deploy.yml`: `pnpm install --frozen-lockfile` at root still works unchanged; replace direct `pnpm lint`/`pnpm build` etc. with `pnpm turbo run lint typecheck test build` (or per-task steps via turbo); fix `deploy.yml`'s `path: dist` to `path: apps/web/dist`.
- Husky/lint-staged/commitlint config stays at root, glob patterns updated to `apps/**/*.{ts,vue}` etc.

**Acceptance:**

- `pnpm install` at root succeeds.
- `pnpm turbo run build` builds `apps/web` and produces the same `dist/` output as before the move.
- CI green on a PR; GitHub Pages deploy still serves the site correctly after merge.

---

## Phase 2 — Extract `packages/engine`

**Goal:** pull all game-rule code into an independent, pure-TypeScript package per the architecture rule in `CLAUDE.md`.

**Do:**

- Create `packages/engine` with its own `package.json` (name `@hexoflat/engine`), `tsconfig.json` extending a shared base, build via `tsc` (or `tsup` if bundling is needed for the Node/Nest consumer later).
- Move into it (from `apps/web/src`): `abstraction/`, `game-resolvers/`, `factory/`, `registry/`, `features/`, `content/` (schemas + content data + accessors), the parts of `models/`, `enums/`, `utils/combat`, `utils/resource`, `utils/inventory`, `utils/freeze` that have no Vue/DOM/`fetch` dependency.
- Formalize the command/event pipeline: define `Command`, `DomainEvent` base types and a single entrypoint shape, e.g. `applyCommand(state: GameState, command: Command): { state: GameState; events: DomainEvent[] }`. Every existing resolver/feature (`interactions-resolver`, `action-starters-registry`, `action-finishers-registry`, `world-tick-feature`, `spawn-resource-feature`, `finish-pending-actions-feature`, `add-resource-spawner-feature`, `execute-hex-action-feature`) gets rewritten to go through this entrypoint instead of being called ad hoc from Pinia stores. Commands are Zod-validated before they touch state.
- `apps/web` adds `@hexoflat/engine` as a workspace dependency (`"@hexoflat/engine": "workspace:*"`). Pinia stores (`world-map-store`, `hero-store`, `gathering-store`, etc.) become thin adapters: dispatch a command to the engine, store the resulting state/events, no game-rule logic left inside `.ts` store files.

**Acceptance:**

- `grep -rE "from 'vue'|from '@vitejs|window\.|document\." packages/engine/src` returns nothing.
- `pnpm --filter @hexoflat/engine build` succeeds standalone (no `apps/web` in the dependency path).
- `apps/web` still builds and the vertical slice behaves identically in manual smoke test (move hero, gather resource, trigger an action).

---

## Phase 3 — Engine unit tests

**Goal:** close the single biggest risk gap — the rules engine currently has ~0 test coverage.

**Do:**

- Vitest project inside `packages/engine`. Move `content.test.ts` here.
- Cover, at minimum, one success-path and one rejected/invalid-command test for every command type: movement, attack resolution, initiative ordering, status effect apply/expire, victory/defeat conditions, and each currently-implemented ability card.

**Acceptance:** `pnpm --filter @hexoflat/engine test` passes; no command handler is untested.

---

## Phase 4 — PixiJS renderer

**Goal:** replace the DOM/CSS hex map with a PixiJS canvas renderer, without touching engine logic (Phase 2 already decoupled it).

**Do:**

- Add `pixi.js` to `apps/web`.
- New render layer (e.g. `apps/web/src/render/`) owning a single `PIXI.Application`; it reads engine state/events and draws the hex grid, hero token, enemy tokens, and overlays (move preview, combat markers, camp-heal, enemy vision). Replace `hex-world-map.vue`'s DOM implementation incrementally, one overlay at a time, not as a single rewrite.
- Vue stays responsible for UI chrome around the board (HUD, top bar, menus) — Pixi only owns the board canvas itself.
- Preserve or replace `data-testid` hooks (`map-scene-root`, `hex-map`, `hex-map-inner`, etc.) with Pixi-queryable equivalents so tests can still target them.

**Acceptance:** parity checklist against the current DOM renderer — move preview, hover, enemy vision overlay, combat markers, camp heal overlay all present and pass the same manual/automated checks as before the swap.

---

## Phase 5 — `apps/api` skeleton (NestJS + Fastify)

**Goal:** stand up the backend shell with the engine as its authoritative simulation.

**Do:**

- `apps/api` using `NestFastifyAdapter`. Modules: `AuthModule`, `ContentModule`, `GameModule` (wraps `@hexoflat/engine`), `HealthModule`.
- REST first: `POST /auth/login`, `POST /auth/register`, `GET /content/*`, `GET|POST /saves`.
- `apps/api` depends on `@hexoflat/engine` as a workspace dependency — if it needs any Nest-specific adapter code, that code lives in `apps/api`, not in the engine package.

**Acceptance:** `pnpm --filter @hexoflat/api start:dev` boots; `GET /health` returns 200; engine import works with zero engine-side changes needed for Nest compatibility.

---

## Phase 6 — PostgreSQL + Drizzle

**Goal:** real persistence.

**Do:**

- `docker-compose.dev.yml` with a `postgres` service for local dev only (full multi-service Docker setup is Phase 11).
- Drizzle schema (in `apps/api` or a new `packages/db`): `users`, `heroes`, `campaigns`, `scenarios`, `saves`, `snapshots`. `drizzle-kit` for migrations.

**Acceptance:** `drizzle-kit generate` + `drizzle-kit push` against the local compose Postgres succeeds; `apps/api` reads/writes through the Drizzle client.

---

## Phase 7 — TanStack Query in `apps/web`

**Goal:** replace the fake "backend" (`fetch` against static `public/*.json`) with real API calls.

**Do:** wrap all calls to `apps/api` (auth, saves, content) in TanStack Query hooks. Remove `src/api/Requests.ts`'s static-JSON fetches.

**Acceptance:** login/save/load flows go through `apps/api`, not `public/users.json` / `public/heroes.json`.

---

## Phase 8 — WebSocket multiplayer sync

**Goal:** drop-in/drop-out co-op per the architecture rule.

**Do:**

- Nest WS gateway in `apps/api`: join active scenario, transfer control of an existing hero, reconnect, state sync.
- `@hexoflat/engine` exposes serializable snapshot + event-log primitives; the gateway uses these for sync and reconnection, not ad hoc state diffing.

**Acceptance:** two browser sessions can join the same scenario and see each other's hero moves in near-real-time; a reconnecting client resumes without full state loss.

---

## Phase 9 — Auth (custom lightweight)

**Goal:** replace the plaintext-password check with real auth.

**Do:** JWT issue/verify + password hashing (argon2 or bcrypt) in `apps/api`; guards on REST and WS. `apps/web` auth store switches to TanStack Query + JWT; route guards updated.

**Acceptance:** login persists across reload; protected routes and WS connections reject unauthenticated requests.

---

## Phase 10 — Playwright e2e

**Goal:** real end-to-end coverage of the vertical slice, including multiplayer.

**Do:** new `e2e/` package (or `apps/web-e2e`) with Playwright config. Cover: login → load map → move hero → attack → win/lose condition, plus a two-client drop-in/reconnect scenario. Add a CI job running Playwright against a built preview + `apps/api` + compose Postgres.

**Acceptance:** `pnpm exec playwright test` green locally and in CI.

---

## Phase 11 — Docker + deploy for `apps/api` (PAUSED)

> **Paused 2026-07-31:** local dev is already fully covered by `docker-compose.dev.yml` (Phase 6). Production hosting only matters once there's an actual reason to expose the backend externally (real players, a demo to show someone). Until then, engineering effort goes to gameplay/content — starting with settling combat design, which is the actual unresolved risk right now, not infra. Revisit this phase when there's a concrete feature/business reason to deploy `apps/api` publicly.

**Goal:** containerize the backend; `apps/web` keeps deploying to GitHub Pages as-is.

**Do:** multi-stage `Dockerfile` for `apps/api` (pnpm-aware); `docker-compose.yml` for the full local stack (api + postgres + web preview). Open decision, not yet made: hosting target for `apps/api` in production (Fly.io / Railway / VPS / other) — GitHub Pages cannot run a Node/WebSocket backend.

**Acceptance:** `docker compose up` runs the full stack locally end-to-end.

---

## Phase 12 — S3 assets, then OpenTelemetry + Sentry (PAUSED)

> **Paused 2026-07-31:** same reasoning as Phase 11 — no external users/assets-at-scale yet to justify this.

**Goal:** externalize assets, add observability.

**Do:**

- Move `public/board-assets`, `public/hero-asssets`, `public/enemy-assets`, `public/cursors` to an S3-compatible bucket (MinIO for local dev); serve via `apps/api` or a CDN in front of the bucket.
- Add Sentry SDK to `apps/web` and `apps/api`. Add OpenTelemetry SDK to `apps/api` (trace REST, WS, and DB calls).

**Acceptance:** errors surface in Sentry for both frontend and backend; traces appear in the chosen OTel backend/collector.
