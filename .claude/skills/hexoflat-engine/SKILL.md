---
name: hexoflat-engine
description: Rules and step-by-step recipe for working inside packages/engine — adding or changing game commands, domain events, game rules, content schemas, randomness, and snapshots. Use whenever a task touches packages/engine/**, adds a new game mechanic or rule, mentions applyCommand, domain events, CONTENT_VERSION, seeded RNG, or asks where a piece of game logic should live.
---

# Working inside `packages/engine`

`packages/engine` is the authoritative rules layer. It is the only place in the repo where game rules may live.

## The one hard constraint

**The engine must stay importable with zero dependencies on Vue, browser APIs, NestJS, or the database.**

Concretely, none of these may appear in `packages/engine/src/**`:

`window`, `document`, `localStorage`, `setInterval`/`setTimeout` for game timing, `import ... from 'vue'`, `import ... from 'pinia'`, anything from `@nestjs/*`, anything from `drizzle-orm`, `Math.random()` (see Randomness below).

If a change appears to require one of these, the change belongs in `apps/web` or `apps/api` instead. Say so rather than adding the import.

## Why this matters (do not treat it as style)

Every rule that lives in the engine is automatically available to the server for authoritative co-op validation, lands in replay and snapshots, and is testable without Pinia/jsdom/a browser. Every rule that leaks into a Pinia store is a rule that has to be written a second time for the server, or that permanently pins the game to single-player.

## Adding a new command — the full recipe

All game-state changes go through validated commands that produce domain events. There is no other legal path.

1. **Zod schema** in `src/commands/hex-engine-commands.ts`. Follow the existing shape exactly:

   ```ts
   export const MyThingCommandSchema = z.object({
     type: z.literal('MY_THING'),
     payload: z.object({ heroId: z.string() /* ... */ }),
   });
   export type MyThingCommand = z.infer<typeof MyThingCommandSchema>;
   ```

2. Add it to the `HexEngineCommand` union **and** to the `HEX_ENGINE_COMMAND_SCHEMAS` record in the same file. Both — the record is what `applyCommand` parses against.

3. **Handler** as a `case` in `src/commands/apply-command.ts`. The switch is exhaustive via `assertNever` — a missing case is a type error, which is intentional.

4. **Emit domain events**, do not just mutate. Events are the output contract: the renderer, the event log, replay and (later) multiplayer sync all read them. A command that changes state without emitting an event is a bug even if the screen looks right.

5. **Pure functions for the actual rules**, in a domain folder (`src/combat/`, `src/hero-movement/`, `src/map/`). The `apply-command.ts` case should orchestrate, not compute. See `src/combat/damage-calculator.ts` for the shape to copy.

6. **Unit tests without Pinia**, colocated as `*.test.ts`. If a test needs a store, the logic is in the wrong layer.

Current commands, for reference: `START_HEX_ACTION`, `FINISH_PENDING_ACTIONS`, `WORLD_TICK`, `ADD_RESOURCE_SPAWNER`, `MOVE_HERO`, `CROSS_EXIT`, `KNOWLEDGE`, `SACRIFICE_TO_SKILL`, `RESET_SKILLS`, `OPEN_PORTAL`, `ENTER_PORTAL`, `BATTLE`.

**`apps/web` and `apps/playwright` import the built `packages/engine/dist`** (git-ignored), not `src`. After any engine change run `pnpm build` in `packages/engine` before web typecheck, web tests or e2e, or they will see the old engine.

Skills and portals follow the same recipe: pure rules in `src/skills/` and `src/portal/` (e.g. `resolvePortalCost`, `applySacrifice`, `getSacrificeOptions`), amounts and prices are computed by the engine from state and **never** read from the command payload. Additive `KnowledgeState` fields (like `skillProgress`) use `.default(...)` and need no `CONTENT_VERSION` bump.

## Item rarity

Rarity is `{ kind: ERarityKind, boss }` printed on tool/equipment/loot content. Read it through `DEFAULT_RARITY` and `rarityTone()` in `src/content/rarity-rules.ts` — never re-declare a fallback. Write rarity explicitly on every new item.

## Randomness

`Math.random()` is banned in engine rules. Rules take an injected generator:

```ts
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
```

Reason: identical inputs plus identical seed must reproduce identical outcomes, or replay, snapshots and authoritative co-op validation all break. Rules already written this way: `src/combat/ai-controller.ts`, `src/map/free-hex-finder.ts`.

Never widen a rule's signature to call `Math.random()` internally "just this once" — pass the generator in.

## Content

Content (heroes, cards, enemies, items, statuses, maps, scenarios) is data, validated with Zod, versioned, and kept separate from runtime state. It lives in `src/content/`.

- Schemas: `content-schema.ts`. Content files: `*.content.ts`. Registration: `content-map.ts`, `index.ts`.
- Display strings are **i18n keys**, never literal text — the engine is language-neutral and `apps/web` resolves them through vue-i18n against `src/locales/{uk,en}/content.json`.
- Prefer capability fields over key checks. Example already in the codebase: any object carrying a `heal` field is a valid `USE` target, so adding a new healing object needs no `hexobjectKey` branch anywhere.
- Write a schema only when a near-term consumer exists. A schema nobody reads is an unverified guess frozen into code.

## `CONTENT_VERSION` and snapshots

`CONTENT_VERSION` (`src/content/content-version.ts`, currently `1`) gates save compatibility. `deserializeState` throws `StaleSnapshotError` on mismatch and `apps/web` discards saved maps — meaning **a bump wipes every player's save**.

Rule of thumb:

- **Additive change** (new optional field, new content category, new command) → do **not** bump. Old payloads must load with a sensible default.
- **Breaking change** (field removed, meaning changed, incompatible shape) → bump, and say so explicitly in the summary so the save wipe is a decision and not a surprise.

`serializeState` also writes a SHA-256 checksum over `{version, map, heroes}`; changing what goes into that object changes the checksum shape. Cover both the old-payload and new-payload path with tests.

## Battle (`src/battle/`, phases B1–B8 of `docs/BATTLE-SYSTEM-PLAN.md`)

The old combat exception is being retired: the new battle runs entirely through the engine. The legacy `apps/web/src/stores/combat-store.ts` and `src/combat/` still drive the live game until B6 deletes them (fate of every file: `docs/battle-system/B0-AUDIT.md`). Do not extend the legacy combat code.

- **One command, many actions.** `BATTLE` (`battle/battle-commands.ts`) carries `{ kind: 'hero', heroId, action }` or `{ kind: 'run-enemy-turn' }`, like `KNOWLEDGE`. `applyBattleCommand` (`battle/apply-battle.ts`) clones the state, runs `performAction`, and on a refusal returns the **original** state plus `BATTLE_REJECTED { rejected, cost?, left? }` — never a half-applied action. New actions: add to `battleActionSchema`, a case in `perform-action.ts`, and say whether they belong to the `defend` or `act` phase.
- **State** is `HexEngineState.battle` (`battle/battle-state.ts`), additive in the snapshot (no `CONTENT_VERSION` bump). Coordinates inside battle are axial `{ q, r }` with `"q,r"` board keys; convert to the map's odd-r offset only at the web boundary (`axialToOffset`). Hearts are integer half-hearts (`hp`), converted from/to `HeroModel` hearts on entry/exit.
- **Prices are content** (`BATTLE_RULES` in `battle/battle-content.ts`); rules read them, never hardcode 3/7/20.
- **Hidden information.** A strike's side (`fromHex`) is secret to the struck side. Enemy AI must decide from `projectBattleForViewer(state, 'enemies')` only, and anything sent to another player goes through `projectBattleForViewer` / `projectBattleEvent`. A test pins this (REQ-BTL-013).
- **Randomness** only via `deriveStream(seed, 'battle:<id>:<purpose>:<n>')` (initiative today).
- **No clock.** Timers live in the web; the engine gets times as command data (timed tasks, B2).
- `startBattle(setup)` builds a battle from a ready `BattleSetup`; the `START_BATTLE` command arrives with encounters (B4/B6), which compute the setup from content.
- Tests are named by requirement id (`REQ-BTL-0xx`); fixtures in `battle/battle-test-setup.ts` (`battleWith`, `giveTurn`, `heroDoes`, `enemyTurn`).

## Checklist before finishing

- [ ] No Vue / browser / Nest / DB import added to `packages/engine`
- [ ] New command has: schema, union entry, `HEX_ENGINE_COMMAND_SCHEMAS` entry, `apply-command.ts` case
- [ ] Command emits domain events, not just mutations
- [ ] Rules are pure functions; `apply-command.ts` only orchestrates
- [ ] No `Math.random()` — generator injected
- [ ] Tests run without Pinia or jsdom
- [ ] `CONTENT_VERSION` bumped only if the change is genuinely breaking
