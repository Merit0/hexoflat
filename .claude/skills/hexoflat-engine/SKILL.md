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

Current commands, for reference: `START_HEX_ACTION`, `FINISH_PENDING_ACTIONS`, `WORLD_TICK`, `ADD_RESOURCE_SPAWNER`, `MOVE_HERO`.

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

## Deliberate exception you will run into

Combat state still lives in `apps/web/src/stores/combat-store.ts` and does **not** go through this command pipeline. This is a tracked, deliberate gap — combat design is unsettled, so migrating it is deferred until the design is ready.

Do **not** "fix" this opportunistically: do not add combat commands to `applyCommand`, do not migrate combat state into the engine, unless the task explicitly asks for it. Pure combat _functions_ in `src/combat/` are fine and already exist — that is the agreed boundary.

## Checklist before finishing

- [ ] No Vue / browser / Nest / DB import added to `packages/engine`
- [ ] New command has: schema, union entry, `HEX_ENGINE_COMMAND_SCHEMAS` entry, `apply-command.ts` case
- [ ] Command emits domain events, not just mutations
- [ ] Rules are pure functions; `apply-command.ts` only orchestrates
- [ ] No `Math.random()` — generator injected
- [ ] Tests run without Pinia or jsdom
- [ ] `CONTENT_VERSION` bumped only if the change is genuinely breaking
