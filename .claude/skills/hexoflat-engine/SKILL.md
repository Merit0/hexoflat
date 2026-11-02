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

5. **Pure functions for the actual rules**, in a domain folder (`src/battle/`, `src/squads/`, `src/hero-movement/`, `src/map/`). The `apply-command.ts` case should orchestrate, not compute. See `src/battle/threat.ts` for the shape to copy.

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

Reason: identical inputs plus identical seed must reproduce identical outcomes, or replay, snapshots and authoritative co-op validation all break. Rules already written this way: `src/battle/initiative.ts` (via `deriveStream`), `src/map/free-hex-finder.ts`.

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

The old combat is gone (B6 deleted `src/combat/`, `EHexActionType.ATTACK/BLOCK` and the web `combat-store`); the battle runs entirely through the engine. `canAttack`/`canBlock` capabilities and `damageMin/Max`/`attackMultiplier` content fields survive only as item-tooltip descriptions. `map/providers/hex-map-provider` is still used by `apps/api`.

- **One command, many actions.** `BATTLE` (`battle/battle-commands.ts`) carries `{ kind: 'hero', heroId, action }` or `{ kind: 'run-enemy-turn' }`, like `KNOWLEDGE`. `applyBattleCommand` (`battle/apply-battle.ts`) clones the state, runs `performAction`, and on a refusal returns the **original** state plus `BATTLE_REJECTED { rejected, cost?, left? }` — never a half-applied action. New actions: add to `battleActionSchema`, a case in `perform-action.ts`, and say whether they belong to the `defend` or `act` phase.
- **State** is `HexEngineState.battle` (`battle/battle-state.ts`), additive in the snapshot (no `CONTENT_VERSION` bump). Coordinates inside battle are axial `{ q, r }` with `"q,r"` board keys; convert to the map's odd-r offset only at the web boundary (`axialToOffset`). Hearts are integer half-hearts (`hp`), converted from/to `HeroModel` hearts on entry/exit.
- **Prices are content** (`BATTLE_RULES` in `battle/battle-content.ts`); rules read them, never hardcode 3/7/20. A step costs 1 Will (rubble and climbing 2, `unarmedPower` 1 = half a heart for an empty hand). The skeleton king has 9 half-hearts so the full-squad balance band (40–60%) holds with cheap steps.
- **`set-hands` (Oleh, 2026-10-30):** `{ kind: 'set-hands', right, left }` (battle item keys or null) puts items in the hero's hands in the act phase of his turn; it costs `rules.swap` per changed hand, stows the outgoing item in the bag, takes the incoming one out of the bag, is free and silent when nothing changes, and refuses unknown keys (`NO_SUCH_ITEM`). The web sends it when the inventory hands change during a battle.
- **`usePrice` (Oleh, 2026-10-31):** every usable item states its price in content (`loot.usePrice`, read with `usePriceOf(key)` from `content`); the battle catalogue derives `usePrice` from the hexobject (no `rules.use`), and `useItem` charges `item.usePrice`. Add a usable item without a price and `use-price.test.ts` / the catalogue throw. Battle initiative is ascending (token 1 first); `drawWithAdvantage` keeps the lower of two. `moveCreature` refuses with `DEFENSE_MODE` while `placedShields` is non-empty.
- **Block window (Oleh, 2026-10-31):** `strike` only validates and spends the Will; `perform-action.ts` then calls `openReaction` (`battle/reaction.ts`), which saves the attacker's turn context in `state.reaction.resume` and hands the turn to the defender (phase `defend`, stage `block`). `finishBlock` (take-hit / reaction-timeout; placed shields are final, there is no confirm-block) either resolves at once or moves to stage `aim`; `aimStrike` / `aimTimeout` resolve and emit `STRIKE_LANDED` + `STRIKES_RESOLVED` (burnedShields = the true shields). While stage is `aim` only `aim` and `reaction-timeout` are legal (`AIM_PENDING`). The projection hides the defender's shields from the attacker (`shieldsRaised`) and the aim options in `REACTION_AIMING`. Tests build windows with `strikeOpened` and aim with `enemyDoes` from `battle-test-setup.ts`.
- **Hero strikes never wait (Oleh, 2026-11-02):** in `finishBlock` (`reaction.ts`) a hero attacker (`attacker.side === 'heroes'`) resolves immediately at `options[0]` (cheapest reachable ring hex, own hex first) instead of opening the `aim` stage, because the enemy defender is an NPC whose shields are guessed instantly. The `aim` stage and `aimStrike`/`aimTimeout` remain for enemy attackers. `balance.test.ts` bands are red after this change (93.8% / 65.2%) pending Oleh's retune.
- **Sweep, boxing and balance (Oleh, 2026-10-31).** `resolveAt` in `reaction.ts` calls `sweepAround` after every non-ranged strike: all living enemies of the attacker's side adjacent to him take `strikePower` (`STRIKE_SWEPT`, wounds only for enemy attackers). Initiative is rolled once (`startRound` rolls only in round 1; later rounds reuse `order`/`draws` and clear `wounds`). Melee strikes are picked at distance via `reachRefusal`/`reachableRing` (strike.ts); `aimOptions(…, ranged)` lists the reachable ring hexes sorted by cost and the attacker walks in `resolveAt`. Crypt battlefield recipe has saws only (`battlefield-crypt.ts`; `growCluster` returns nothing for size 0). AI: `isCrowdedAround`/`reachableFoes` keep enemies out of crowds unless the hero is boxed in. Fog policies are `FOG`/`ALL_REVEALED` only.
- **Guard = the shield tool's Block.** `place-shield` / `remove-shield` work in the act phase too: the hero puts shield sides on hexes beside him (`guardHexRefusal`, 4 Will each, up to the shield capacity), and `finishTurn` stores them in `state.guards[id]` (additive, defaulted). When he is struck, `beginTurn` puts them back as `placedShields` with `lockedShields` = their count (no refund for locked ones on remove, dodge or take-hit). `projectBattleForViewer` shows only the viewer's own guards and hides the active creature's shields from the other side; `SHIELD_PLACED/REMOVED` carry `guard: true` and `projectBattleEvent` strips the hex for the other side. The ACTION / MOVE statuses are a UI concept (web `battle-stage.ts`); the engine does not enforce them and enemy AI does not use guards.
- **Hidden information.** A strike's side (`fromHex`) is secret to the struck side. Enemy AI must decide from `projectBattleForViewer(state, 'enemies')` only, and anything sent to another player goes through `projectBattleForViewer` / `projectBattleEvent`. A test pins this (REQ-BTL-013).
- **Randomness** only via `deriveStream(seed, 'battle:<id>:<purpose>:<n>')` (initiative today).
- **No clock.** Every `BATTLE` command carries `atMs` from the web. A timed task (`battle/timed-task.ts`) stores `deadlineMs`; an answer after it counts as wrong, and the web sends `task-timeout` itself. While `state.task` is open every other action (and the enemy turn) is `TASK_OPEN`; the answer is hidden in the projection.
- **Displacement** (push, oil slide, ledge fall, saw) is one module, `battle/displacement.ts` (`resolvePush`; PULL was removed, to come back later). Heroes open a task first (`displace-actions.ts`), enemies resolve at once. Hazard on entry lives in `battle/hazard.ts`; anything that can kill the active creature mid-action calls `endTurnIfActiveFell`.
- **Battle content** is `battle/battle-catalogue.ts` (Zod): items, creatures and board objects with i18n `title`/`tableRule` keys (`content.battle.<id>.*`, texts in web `content.json`, checked by the web locale-completeness test). Build enemies with `enemyCreature(kind, id, pos)`; map tokens reach battle kinds through `battleKindOfHexobject` (`skeletor` → `skeleton-warrior`). Tune balance here, not in rules.
- **Enemy AI** lives in `battle/ai/` as pure functions over `projectBattleForViewer(state, 'enemies')`, dispatched by the creature's `behaviour`. The melee logic is side-neutral and also drives the test hero bot. After a strike an attacker hides its side (`hideStep`); without it the nearest-shield defence blocks almost everything and battles stall.
- **Balance** (REQ-BTL-016) runs `battle/battle-sim.ts` over 500 seeds in `balance.test.ts` (~20 s). Any change to AI or numbers must keep it inside its bands; record new numbers in the plan journal.
- **Battlefield** = the board generator with the `battlefield-crypt` model (pieces in `boards/pipeline/pieces/battlefield.ts`; battle reliefs `rubble`/`ledge`/`oil`/`saw` are generator terrains with `symbol: null`, pillars are `stone-wall`, boulders are `rock`). `battle/battlefield.ts` turns the pipeline board into the axial battle board; `battle/battlefield-setup.ts` (`deployBattle`) places creatures by approach direction or ambush and sets the round-1 `advantage`. Seeds: `battlefieldSeed(squadId, attempt)`. Every battlefield is enclosed by a border: the model's `bounds: [{ kind: 'wall', enclose: true, hexobject }]` (default `stone-wall`, any hexobject key from the config), so the frame must leave one ring of room around the field (crypt: radius 4 in a 13×11 frame). Border walls have no `regionId`; tactical checks count only `regionId === 'field'` cells, so the border is never "cover".
- `startBattle(setup)` builds a battle from a ready `BattleSetup`; on the map it is started by the `BATTLE` kind `start` (below).

## Squads as hexobject tokens (`src/squads/`, B6b)

- **On any map there are only hexobject tokens.** A squad is a `CREATURE` hexobject with a `creature.squad` block (`content/creatures.content.ts`, `squadContent`: `members`, `watcher`, `boss`, `loot` — one key, `battlefieldBiome`, `tableRule`). Keys: `lone-skeleton`, `skeleton-pack`, `bone-court`, `archer-watch` (archers postponed, not in the cave). Instance state lives on the token's `creature`: `scouted`, `attempts` (hydrated in `HexMapModel.hydrateHexobject` via `squadInstanceOf`/`withSquadInstance`). Squad id = hexobject id `<col>:<row>:<key>`. There is no `HexTileModel.encounter`.
- **Actions are hex actions.** `EHexActionType.ATTACK` (priority 90) / `SCOUT` (80), offered by `interactions-resolver` (`squadActions`) from tool capabilities: `canAttack` (sword, hand — and axe/pickaxe today), `canScout` (hand only); SCOUT only while unscouted and with >1 member. The tool hex shows only the top-priority action, so today the hand shows ATTACK. **SNEAK was removed — Oleh does not approve it; don't reintroduce.** Will costs are content `willCost` (2 / 1), charged by the normal `START_HEX_ACTION` path. `applyStartHexAction` hands squad actions to `startSquadAction` (`squads/apply-squad.ts`) instead of `ExecuteHexActionFeature` (like `isWorldGate`), because they need `engagement`/`knowledge`; squad events come before `HEX_ACTION_STARTED`, a refusal adds `SQUAD_REJECTED { reason }` + `HEX_ACTION_START_REJECTED`. The starters registry answers `SQUAD_ONLY` for those types on anything else.
- **Lifecycle in `BATTLE`.** `battle-commands.ts` kinds `start` (hero creatures from web) and `close` (`SquadLifecycleCommand`, `isSquadLifecycleCommand`) go to `applySquadLifecycle`; `hero` / `run-enemy-turn` (`FightCommand`, `isFightCommand`) go to `applyBattleCommand`. Events: `SQUAD_SCOUTED`, `AMBUSH`, `BATTLE_REQUESTED`, `SQUAD_DEFEATED`, `LOOT_DROPPED`, `BATTLE_CLOSED { outcome, heroAt, heroes: { id, hearts, consumed }, kills }`, `SQUAD_REJECTED`.
- **Watcher** (`squad.watcher: true`) ambushes in `MOVE_HERO` (`hero-movement/apply-move-hero.ts`): `ambushStop` cuts the path at the first watched hex, `ambushAt` opens the engagement. No player action.
- **Victory** replaces the squad token with its `loot` token (`TAKE` picks it up); **defeat** bumps `attempts`, so `battlefieldSeed(squadId, attempts)` gives a new board.
- `HexEngineState.engagement` (`squads/engagement.ts`, `squadId`) is additive in the snapshot; an old `encounterId` is migrated by `z.preprocess`. `threat.ts`, `battlefield-setup.ts` moved to `battle/` (`squadThreat`, `THREAT_RULES` with `unarmedPower`). UI projection: `projectSquads(map, heroProfile)` (revealed only; members `null` until scouted), `watchedHexes`, `watchingSquad`.
- **Saves (D1, no `CONTENT_VERSION` bump):** `squads/squad-migration.ts` — an old `tile.encounter` becomes the squad token (status `loot` → loot token, `looted` → empty), a legacy `skeletor` hexobject becomes `lone-skeleton`.
- **Generator:** the `objects: squads` piece (`boards/pipeline/pieces/squads.ts`, params `{ squad, spot, minSteps }`) places the token. A squad is `SOLID` for the hero, but `walledForBoardWalk` (`content/squad-keys.ts`) treats it as open floor for the generator's reachability check and `measureBoard`, because a fight or SNEAK clears the way.
- Tests: `squads/squads.test.ts` (REQ-ENC-001…004, tool menu), `squads/squad-battle.test.ts` (REQ-ENC-007, 008, save round-trip, migrations); fixture `squads/squad-test-setup.ts`.
- Tests are named by requirement id (`REQ-BTL-0xx`); fixtures in `battle/battle-test-setup.ts` (`battleWith`, `giveTurn`, `heroDoes`, `enemyTurn`).

## Checklist before finishing

- [ ] No Vue / browser / Nest / DB import added to `packages/engine`
- [ ] New command has: schema, union entry, `HEX_ENGINE_COMMAND_SCHEMAS` entry, `apply-command.ts` case
- [ ] Command emits domain events, not just mutations
- [ ] Rules are pure functions; `apply-command.ts` only orchestrates
- [ ] No `Math.random()` — generator injected
- [ ] Tests run without Pinia or jsdom
- [ ] `CONTENT_VERSION` bumped only if the change is genuinely breaking
- **Window deadline, fuzz, cave exit (Oleh, 2026-11-01).** `performAction`'s guard rejects `place-shield`, `remove-shield` and `aim` with `WINDOW_CLOSED` once `atMs` passes `reaction.deadlineMs` (`reaction-timeout` and `take-hit` still close it). The cave `gates: entry` piece builds `cave-exit` into the outer wall of the entry room (the room farthest from the centre, chosen in `blobs`), so the entry coordinate is a wall cell on the border. `battle-fuzz.test.ts` (random play incl. garbage actions, `FUZZ_BATTLES` env) and `battle-adhoc.test.ts` guard the invariants; add a new rule's invariant there. Read `docs/battle-system/BATTLE-HANDOFF.md` first.
