# hexoflat

Turn-based tactical hex-grid co-op game. See [CLAUDE.md](./CLAUDE.md) for the game concept, target stack, and architecture rules, and [docs/MIGRATION-PLAN.md](./docs/MIGRATION-PLAN.md) for where the migration to that stack currently stands.

This doc is a practical guide to get the project running locally — for development or for manually testing a change.

## Repo layout

- `apps/web` — Vue 3 + Vite frontend (the game client)
- `apps/api` — NestJS backend (REST + WebSocket, Postgres via Drizzle)
- `apps/playwright` — end-to-end tests driving `apps/web` against a real `apps/api`
- `packages/engine` — the framework-free game engine shared by both apps

## Prerequisites

- Node.js 20+ (Node 22/24 also fine)
- [pnpm](https://pnpm.io) — version is pinned in `package.json` (`packageManager: pnpm@11.17.0`); `corepack enable` will pick it up automatically
- Docker (only needed to run Postgres for the backend — the frontend alone doesn't need it)

## 1. Install dependencies

From the repo root (this installs for every workspace package):

```bash
pnpm install
```

## 2. Run the backend (`apps/api`)

### 2.1 Start Postgres

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts Postgres on `localhost:5433` (not the default 5432, to avoid clashing with a local Postgres install) with a `hexoflat`/`hexoflat` user/db.

### 2.2 Push the schema

```bash
pnpm --filter @hexoflat/api db:push
```

### 2.3 Environment variables (optional for local dev)

`apps/api`'s defaults already match `docker-compose.dev.yml`, so **you don't need a `.env` file to run it locally**. `apps/api/.env.example` documents what's overridable — copy it to `.env` and export the values in your shell if you need to point at a different database or change the JWT settings (the API doesn't auto-load `.env` files, there's no dotenv wiring):

| Variable         | Default                                                  | Notes                                                                                        |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | `postgresql://hexoflat:hexoflat@localhost:5433/hexoflat` | matches `docker-compose.dev.yml`                                                             |
| `CORS_ORIGIN`    | `http://localhost:5173`                                  | must match wherever `apps/web` is served from                                                |
| `JWT_SECRET`     | `dev-insecure-secret-change-me`                          | **fine for local dev** — the API refuses to start on this default when `NODE_ENV=production` |
| `JWT_EXPIRES_IN` | `7d`                                                     |                                                                                              |
| `PORT`           | `3000`                                                   |                                                                                              |

### 2.4 Start the API

```bash
pnpm --filter @hexoflat/api start:dev
```

Runs on `http://localhost:3000` with auto-reload. Verify it's up:

```bash
curl http://localhost:3000/health
```

## 3. Run the frontend (`apps/web`)

No `.env` needed for local dev either — it defaults to `VITE_API_URL=http://localhost:3000`, i.e. the API from step 2.

```bash
pnpm --filter @hexoflat/web dev
```

Open `http://localhost:5173`. Register a new account on the login screen (there's no seeded user) — that's the whole flow: register → auto-logged-in → land on the world map.

## 4. Manual testing checklist

With both `apps/api` (step 2) and `apps/web` (step 3) running:

1. **Register** a new account on the login screen (username + password ≥ 8 chars + display name).
2. Confirm you land on `/world/camping` with a hero on the board.
3. Click an adjacent tile to **move** the hero; the steps counter in the top bar should update.
4. Interact with a resource tile (cut/mine/take) and confirm it shows up in the inventory overlay.
5. Refresh the page — you should be logged back out to `/login` (session currently lives in memory only, by design; see PR "Security-critical fixes").
6. Log back in with the same account to confirm credentials persisted correctly server-side.

## 5. Automated tests

Everything, across all packages, from the repo root:

```bash
pnpm turbo run lint typecheck test build
```

Individually:

```bash
pnpm --filter @hexoflat/engine test   # pure engine unit tests, no services needed
pnpm --filter @hexoflat/api test      # API unit tests, no services needed
pnpm --filter @hexoflat/web test      # frontend unit tests, no services needed
```

### End-to-end (Playwright)

Needs Postgres + `apps/api` running (steps 2.1–2.4) — it registers a throwaway test user against the real API. `apps/web` itself is built and served automatically by Playwright.

```bash
pnpm --filter @hexoflat/playwright test:e2e
```

Headed (watch it click through the browser):

```bash
pnpm --filter @hexoflat/playwright test:e2e:headed
```

## Troubleshooting

- **API won't start / `/health` unreachable** — check Postgres is up: `docker compose -f docker-compose.dev.yml ps`.
- **Login/register calls fail from the browser with a CORS error** — `apps/api`'s `CORS_ORIGIN` must match the origin `apps/web` is actually served from (default `http://localhost:5173`).
- **`pnpm --filter @hexoflat/api db:push` fails to connect** — Postgres takes a few seconds to become healthy after `docker compose up -d`; re-run once `docker compose -f docker-compose.dev.yml ps` shows it as `healthy`.
- **Playwright can't reach the API** — `global-setup.ts` checks `/health` before anything else and prints exactly which URL it tried; make sure step 2 is done first.
