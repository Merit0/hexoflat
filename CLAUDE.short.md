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

## Current status (details: [`docs/PROJECT-STATUS.md`](./docs/PROJECT-STATUS.md) — read the relevant section before touching that area)

Migration phases 1–10 and the God Class refactor (G0–G6) are done; phases 11–12 (production deploy, S3/OpenTelemetry/Sentry) are deliberately paused. Active program: **player persistence on the server** ([`docs/player-persistence-plan.md`](./docs/player-persistence-plan.md); read its last sections first). D1, D2, D4a, D4b-A, D4b-3/4/5 and **D4b-6 (2026-11-10)** are done; next is D3 (shop), which needs a first source of coins.

Invariants that are easy to break:

- **The server owns the hero and the world.** The web is a projection: it sends commands (`/player` socket, `world:command`), waits for the answer and never predicts Will, health, inventory or map changes. No offline path exists: `world-map-store` reads only the server document cache and shows a load error with retry when there is none. Every `DEV_*` command and e2e fixture endpoint is refused unless `HEXOFLAT_E2E_FIXTURES=1` and not production.
- A new browser verb or header must be added to `apps/api/src/cors.ts`. After engine edits run `pnpm --filter @hexoflat/engine build` (web and e2e read `packages/engine/dist`).
- ESLint ratchets are pinned to measured maximums (`max-lines` in `apps/web/src` is 469); lower them when code shrinks, never raise them, never add to `KNOWN_CYCLE_FILES`. Direct `localStorage`/`Math.random()` are banned in `world-map-store.ts` and `hero-inventory-store.ts`.
- Battle: one engine (`packages/engine/src/battle/`), server-held (`WORLD_BATTLE`); squads are `CREATURE` hexobject tokens, not a separate store. Read [`docs/battle-system/BATTLE-HANDOFF.md`](./docs/battle-system/BATTLE-HANDOFF.md) first in a battle chat. Two balance tests are knowingly `it.skip` until the shield rework: do not retune HP/prices or re-enable them.
- UI and design belong to Oleh: never change visuals, boards or layouts that were not asked for. Tool hex shows one top-priority action. SNEAK is not approved.
- Item rarity is `{ kind, boss }` (`gloom`/`idol`/`spark`/`god-executor`); Will is spent only through engine commands and every readout uses `components/gui/will-number.vue`.
- Inventory, stash and skills rules live in the engine (`packages/engine/src/inventory/`, `skills/`); web stores are projections. Docs: [`docs/INVENTORY-ENGINE-MIGRATION-PLAN.md`](./docs/INVENTORY-ENGINE-MIGRATION-PLAN.md), [`docs/stash/stash-board-spec-doc-ref.md`](./docs/stash/stash-board-spec-doc-ref.md), [`docs/SKILL-TREE-V2-PLAN.md`](./docs/SKILL-TREE-V2-PLAN.md), [`docs/RETURN-SCROLL-PLAN.md`](./docs/RETURN-SCROLL-PLAN.md), [`docs/RARITY-REALMS-PLAN.md`](./docs/RARITY-REALMS-PLAN.md), [`docs/ui-design/path-of-will-login-page.md`](./docs/ui-design/path-of-will-login-page.md).
- Maps: STATIC / DUNGEON / SCENARIO boards ([`docs/WORLD-MAP-BOARDS-PLAN.md`](./docs/WORLD-MAP-BOARDS-PLAN.md), then [`docs/BOARD-GENERATOR-PLAN.md`](./docs/BOARD-GENERATOR-PLAN.md)). Gameplay content next: [`docs/EXPLORATION-SLICE-WORKFLOW.md`](./docs/EXPLORATION-SLICE-WORKFLOW.md) (phases E0–E9, one chat each; read its section 3 conflicts first). Phase breakdown: [`docs/MIGRATION-PLAN.md`](./docs/MIGRATION-PLAN.md).

## Design research

[`docs/design/gloomhaven-frosthaven-scout-report.md`](./docs/design/gloomhaven-frosthaven-scout-report.md) (2026-07-24) is a scout report on Gloomhaven/Frosthaven mechanics, UX, and player/community feedback — what to keep as a principle, what to avoid copying, and concrete UX patterns (intent → preview → confirm → explained result, rule trace, AI intent overlay, complexity budgets, drop-in/drop-out multiplayer model). It's design inspiration, not a spec, and must not be a source of copied names/text/art/balance (see the IP constraint above). Consult it before designing new mechanics, cards, scenarios, or campaign/meta systems — especially before tackling the combat design gap noted above, since that report's "Phase 1 — Combat vertical slice" is exactly that unresolved piece.

[`docs/design/tactical-coop-dungeon-crawler-scout-report.md`](./docs/design/tactical-coop-dungeon-crawler-scout-report.md) (2026-08-05) broadens the research beyond one game family: 15+ top coop/solo tactical dungeon crawlers (Descent, Massive Darkness 2, Kingdom Death: Monster, Too Many Bones, Tainted Grail, Middara, Sword & Sorcery, Mansions of Madness, Zombicide, Imperial Assault, Arkham Horror LCG, Sleeping Gods, D&D Adventure System, and others), broken down by hero movement, combat/initiative/AI, crafting/itemization, dungeon/exploration generation, skill trees/hero progression, and quest/campaign/journey structure. Section 10 synthesizes a proposed original Hexoflat model combining elements from ≥2 independent sources per subsystem — same rule applies: design inspiration only, never copy names/text/art/exact formulas.

Add future scout/research docs to `docs/design/` and reference them here.

## Workflow rules

- Always ask before `git commit` — not just before `git push`.
- **After every finished feature, update the project skills** (`.claude/skills/*/SKILL.md`) with what the feature taught: new commands/hooks/files, new gotchas, changed rules, new plan docs. Put the detail in `docs/PROJECT-STATUS.md` or the skill; keep this file to short invariants and links (it is loaded in every chat, so every line costs tokens). A feature is not done until the skills describe the code as it now is (stale skills mislead the next chat).
- E2E is grouped by feature (`apps/playwright/e2e/<group>/`, tags `@auth @board @camp @combat @hero @shell`, `@smoke` on single tests). `apps/playwright/impact-map.ts` + `scripts/select-e2e*.ts` pick the groups a diff affects: pre-push runs only those (`E2E_ALL=1` / `E2E_SKIP=1` override), the gating PR does the same in the `e2e-plan` job, pushes to `main` and nightly run everything. Plan: `docs/e2e/e2e-impact-selection-plan.md`; new feature folders must be added to a group's `roots`, `pnpm run e2e:map:check` guards the tags.
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build (parallel), then e2e (gated behind all of those passing), then deploys `apps/web` + the Allure report to GitHub Pages — one sequential pipeline, on every PR (any target branch) and on push to `main`/`game-dev-vite`. It used to be two separate workflows that each ran their own e2e job; merged 2026-08-12 because that duplicated the most expensive job and caused runner queueing on every PR.
