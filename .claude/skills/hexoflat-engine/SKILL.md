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

Current commands, for reference (engine `applyCommand`; player commands such as `SHOP_*` live in `PLAYER_COMMAND_SCHEMAS`): `START_HEX_ACTION`, `FINISH_PENDING_ACTIONS`, `WORLD_TICK`, `ADD_RESOURCE_SPAWNER`, `MOVE_HERO`, `CROSS_EXIT`, `KNOWLEDGE`, `SACRIFICE_TO_SKILL`, `RESET_SKILLS`, `OPEN_PORTAL`, `ENTER_PORTAL`, `BATTLE`.

**`apps/web` and `apps/playwright` import the built `packages/engine/dist`** (git-ignored), not `src`. After any engine change run `pnpm build` in `packages/engine` before web typecheck, web tests or e2e, or they will see the old engine.

Skills and portals follow the same recipe: pure rules in `src/skills/` and `src/portal/` (e.g. `resolvePortalCost`, `applySacrifice`, `getSacrificeOptions`), amounts and prices are computed by the engine from state and **never** read from the command payload. Additive `KnowledgeState` fields (like `skillProgress`) use `.default(...)` and need no `CONTENT_VERSION` bump.

Will capacity (W0, 2026-11-10): a new hero starts full at 50/50 (`KNOWLEDGE_RULES.startingWill`/`capacity`). Capacity is stored per hero in `knowledge.capacity` and computed only by `willCapacityOf(modifiers)` (`knowledge/math.ts`, base + modifiers); a future gear or skill source passes its modifier there and must not refill Will on a raise (clamp `current` on a drop, like `HeroModel.setMaxHealthBonus`). Tests that count Will down from a fresh hero start at 50; `boards/will-budget.test.ts` (REQ-BOARD-008) guards that a cave round trip (up to 38) fits the capacity.

## Item rarity

Rarity is `{ kind: ERarityKind, boss }` printed on tool/equipment/loot content. Read it through `DEFAULT_RARITY` and `rarityTone()` in `src/content/rarity-rules.ts` — never re-declare a fallback. Write rarity explicitly on every new item.

## Coin prices and traders (SH0 of `docs/shop/SHOP-PLAN.md`, 2026-11-10)

- `coinPrice` (int ≥ 1) is a top-level content field, read only through `coinPriceOf(key)` (`null` = not for sale). It is Coins, `usePrice` is Will — never mix them. Every LOOT/TOOL/EQUIPMENT key has a price except `coins` and `hand`, nothing outside those groups has one, and **every price is divisible by 4** (future ½ and ¼ discounts); `content/coin-price.test.ts` pins this and the approved table, so a new bag item needs a price.
- `TRADERS` (`content/traders.content.ts`, `TTraderKey`, `TRADER_KEYS`) is data: i18n `title`/`line` (`content.traders.<key>.*`, collected by web `collectContentLocaleKeys`), `stallHexobjectKey` (the only link stall → trader), `sellRate: { num, den }` integers (sell = `max(1, floor(price × num / den))`, no floats), goods/buyback slots, `refresh: { baseWill, factor }`, `guaranteed` + weighted `pool` + `rolls`. `validateContent` also runs `traderFailures` (strict schema, unique keys, prices, `min ≤ max ≤ maxStack`, `guaranteed + rolls ≤ goodsSlots`, `rolls ≤ pool`).
- `TRADERS.ilva` has 8 goods slots and `rolls: 7` (1 guaranteed + 7 = all slots, a content test keeps `guaranteed + rolls = goodsSlots`); BUYBACK has 7. A stored trader with an older slot count is kept as it is until its next refresh.
- Camp objects `trader-stall` (OPEN with the hand, 0 Will) and `training-grounds` (not interactable, `isLocked`, no actions) are drawn in `CAMPING_BOARD` (`S` r09 c10, `R` r05 c10). The server has **no** drawing-hash rebuild of a stored static map (B11 died with the client `world-storage.ts`), so `deserializeWorld` calls `installCampFacilities(map, hero)` (`world/camp-facilities.ts`) for `camping`: each key in `CAMP_FACILITY_KEYS` missing from the map is placed on its drawn hex when that hex is empty and the hero is not on it (additive, like `installCampBook`; same `mapId`). A new camp object that old saves must get goes into `CAMP_FACILITY_KEYS`.

## Trade rules (`src/trade/`, SH1 of `docs/shop/SHOP-PLAN.md`, 2026-11-10)

- Pure rules, public entry `trade/index.ts` (re-exported from `src/index.ts`): `traderView(progress, key, rngSeed)` (stored trader, or a lazy serial 0 rolled from `deriveStream(rngSeed, 'trader:<key>:0')`; it never writes), `rollGoods(def, rng)` (guaranteed first, then `rolls` weighted picks without repeats, rest `null`), `sellUnitPrice` (`max(1, floor(price × num / den))`, `null` for coins and unpriced keys — integers only), `refreshPrice` (`baseWill × factor ^ paidRefreshes` while `state.trip === progress.trips`, else base), `walletCoins` (bag + hands, never the stash), `planBuy`, `planSell`, `planRefresh`. A plan returns the new `InventoryState`/`TraderState` (no revision bump) or `{ ok: false, reason: TTradeError, price }`.
- Prices come only from `coinPriceOf` and `TRADERS`; a buy from BUYBACK costs its `unitPrice` (the price it was sold for). `expectedPrice` is the total of the exact amount; a mismatch is `PRICE_CHANGED` with the real price. Coins are paid smallest bag stack first, hands last (`trade/coin-purse.ts`); payment happens before placement, so freed coin cells take the item. Sold coins go to the bag through `placeInto`. BUYBACK is kept oldest → newest, compacted, oldest dropped when full, stackables of the same key and price merge within `maxStack` (`trade/trade-lists.ts`).
- `rngSeed` is the server's `server_state.rngSeed`; it is a parameter only. The client must never import `rollGoods`/`traderView`; it gets ready `goods` in the `progress` projection (SH2).
- `progress` v6: `trips` (incremented by `travelWorld` when the destination's `boardKind` is `DUNGEON`) and `traders` (`tradersStateSchema`, partial record by `TRADER_KEYS`). Upcaster 5 → 6 adds `trips: 0, traders: {}`.
- Player commands `SHOP_BUY` / `SHOP_SELL` (`['inventory', 'progress']`, revision `aggregate`) and `SHOP_REFRESH` (`['progress']`, revision `knowledge`) run in `aggregates/apply-trade-command.ts`. `PlayerCommandContext.trade?: { atTrader, rngSeed }` is optional: without it every `SHOP_*` answers `NOT_AT_TRADER`. Checks: hero/revision → `NOT_AT_TRADER` → `BATTLE_OPEN` (`ctx.inventory.battleOpen`) → rules. Events `ITEM_BOUGHT`/`ITEM_SOLD` + `INVENTORY_CHANGED`, `WILL_SPENT` (reason `trader-refresh`) + `TRADER_REFRESHED`; refusal `TRADE_REJECTED { reason, price }` (in `REJECTION_TYPES`); too little Will for a refresh is `WILL_REJECTED`.
- Tests: `trade/*.test.ts` (fixtures in `trade/trade-test-setup.ts`: `inventoryWith`, `traderWith`, `fullBag`), `aggregates/trade-commands.test.ts`.
- **Server wiring (SH2, 2026-11-10).** `serverTradeContext(presence, rngSeed)` (`aggregates/server-trade-context.ts`) names the trader whose `stallHexobjectKey` the hero stands next to (`standsNextToCampObject`), else `null`. `IAggregateDefinition.project(state, server: AggregateServerState)` — the `progress` projection fills every `TRADER_KEYS` trader with `tradersForClient` (stored, or lazy serial 0) and throws without `rngSeed`; the seed itself never enters the projection. The API keeps the seed in `hero_aggregates.server_state` of the `progress` row: `LoadedAggregate.serverState`, `ensureRngSeed` (one conditional `UPDATE` in `loadAggregates*` whenever `progress` is loaded), so any new projection must be built as `projectAggregate({ ...loaded, revision, state })`, never from a bare `{ kind, revision, state }`. `SHOP_REFRESH` is `guarded` for `BATTLE_OPEN` like the inventory commands. Ledger reason `shop` (`ITEM_BOUGHT`/`ITEM_SOLD` → coins and item rows). Dev fixture: `traderFixtureSchema` + `applyTraderFixture` (`trade/trader-fixture.ts`), served by `POST /player/dev/trader-fixture` (fixtures flag only). Web `fake-player-server.ts` uses `FAKE_RNG_SEED` and the same projection/context. API tests: `apps/api/src/player/shop.integration.spec.ts`.

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
- **Hero strikes never wait (Oleh, 2026-11-02):** in `finishBlock` (`reaction.ts`) a hero attacker (`attacker.side === 'heroes'`) resolves immediately at `options[0]` (cheapest reachable ring hex, own hex first) instead of opening the `aim` stage, because the enemy defender is an NPC whose shields are guessed instantly. The `aim` stage and `aimStrike`/`aimTimeout` remain for enemy attackers. `balance.test.ts` bands are knowingly red after this change and both tests are `it.skip`ped (93.8% / 65.2%); Oleh will rework the hero's shields first, so do not retune before that.
- **Strike refusal order (2026-11-02):** `validateStrike` returns `null` when `turnWill < rules.strike` so `spendTurnWill` answers `INSUFFICIENT_WILL`; otherwise `reachRefusal` runs with `turnWill - strike`, and an adjacent hero is never refused as `NOT_ADJACENT` because of short Will (test in `strike.test.ts`). Saw hexes are never strike positions (`strikeSideHexes`).
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
- **Lifecycle in `BATTLE`.** `battle-commands.ts` kinds `start` (hero creatures from web) and `close` (`SquadLifecycleCommand`, `isSquadLifecycleCommand`) go to `applySquadLifecycle`; `hero` / `run-enemy-turn` (`FightCommand`, `isFightCommand`) go to `applyBattleCommand`. Events: `SQUAD_SCOUTED`, `AMBUSH`, `BATTLE_REQUESTED`, `SQUAD_DEFEATED`, `BATTLE_CLOSED { outcome, heroAt, heroes: { id, hearts, consumed }, kills }`, `SQUAD_REJECTED`.
- **Watcher** (`squad.watcher: true`) ambushes in `MOVE_HERO` (`hero-movement/apply-move-hero.ts`): `ambushStop` cuts the path at the first watched hex, `ambushAt` opens the engagement. No player action.
- **Victory** replaces the squad token with its `loot` token (`TAKE` picks it up); **defeat** bumps `attempts`, so `battlefieldSeed(squadId, attempts)` gives a new board.
- `HexEngineState.engagement` (`squads/engagement.ts`, `squadId`) is additive in the snapshot; an old `encounterId` is migrated by `z.preprocess`. `threat.ts`, `battlefield-setup.ts` moved to `battle/` (`squadThreat`, `THREAT_RULES` with `unarmedPower`). UI projection: `projectSquads(map, heroProfile)` (revealed only; members `null` until scouted), `watchedHexes`, `watchingSquad`.
- **Saves (D1, no `CONTENT_VERSION` bump):** `squads/squad-migration.ts` — an old `tile.encounter` becomes the squad token (status `loot` or `looted` → empty hex, because victory no longer drops loot), a legacy `skeletor` hexobject becomes `lone-skeleton`.
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

## Inventory transfers and the camp stash (`src/inventory/`, 2026-11-08)

- Pure rules over a flat aggregate `{ bag, equip, stash }` of `InventoryItem` cells (`slotKey` / `isNew` belong to the web adapter, the rules never read them): `planItemMove`, `planItemAutoPlace`, `planStoreResources`, `planSortStash`, `planUnlockStashChest`, `carriedWeightKg`, `compareItemsForSort`, `categoryOf`. All return a result with a new aggregate or a refusal code (`TTransferError`), never mutate, never touch randomness (`newId` is injected for split stacks).
- Stash model: up to 5 chests of 6x7 = 42 cells (`stash-constants.ts`), `IStashState { cells (210), chests }`, only the first `chests * 42` cells are open. Chest 1 is the free camp reward (`CLAIM_CAMP_CHEST`); `STASH_CHEST_PRICES` = `[0, 100, 1000, 1000, 1000]`, bought in order (owned 0 answers `CAMP_CHEST_NOT_CLAIMED`). `planUnlockStashChest` pays exactly the price from the coins held in a hand slot (`coinHandSlot`) and leaves the rest; coins in the bag or the stash never count.
- Stash weighs nothing; weight may grow only up to the capacity (`OVERWEIGHT`), shrinking is always allowed. `stashPreferred` (a cell range) makes auto-place and Store resources fill the chest on view first. No chest bought: `NO_CHEST`.
- Inventory moves are engine commands since I2 (`MOVE_ITEM`, `AUTO_PLACE_ITEM`, `STORE_RESOURCES`, `SORT_STASH`, `UNLOCK_STASH_CHEST`, all with `heroId` + `revision`; `inventory/apply-inventory.ts` orchestrates the `plan*` rules through `inventory-adapter.ts`). `stashOpen`/`battleOpen` come from `HexEngineState.inventoryContext`, never from the payload (`UNLOCK_STASH_CHEST` also needs `stashOpen`, checked first); a refusal returns the same state plus `ITEM_TRANSFER_REJECTED { heroId, command, reason }`, a no-op plan keeps the revision. The web still uses its stores until I4 (plan `docs/INVENTORY-ENGINE-MIGRATION-PLAN.md`).
- `InventoryState` (I1, `inventory-state.ts`) is the per-hero aggregate `{ heroId, revision, capacityKg, bag[53], equip, stash { chests, starterGiven, cells[210] }, idSeq }` in `HexEngineState.inventory?` and the snapshot (additive). Items are slim (`id,key,type,stackKey?,amount`: no `slotKey`/`isNew`); an empty hand is `null`. Bag cell order and the Will cell live in `bag-layout.ts`; new ids come from `mintItem` (`<heroId>:<idSeq>`), never from `crypto`. `emptyInventoryState` is the only constructor: a new hero holds nothing (no starter scrolls or gear; `migrateLegacyInventory` is gone, local saves are not carried over).
- **Pickups and spent items (I3a):** there is no inventory port any more. `IActionContext.inventory` is an `IInventoryDraft { current, events }` that `applyCommand` fills from `HexEngineState.inventory` and writes back (`BoundActionContext` = the context after binding; `HexEngineActionContext` is what callers pass and has no `inventory`). Finishers call `grantToDraft(ctx.inventory, key, amount, 'pickup')`; the portal calls `consumeFromDraft`. Public commands `GRANT_ITEM` / `CONSUME_ITEM` (heroId + revision) use the same `plan-stock.ts` rules (`planGrant` is atomic, one piece per cell for non-stackables, first free bag cell). A state without `inventory` refuses a pickup with `NO_INVENTORY`.
- **Battle and the inventory (I3b):** a battle `start` takes the hero's hands and up to three battle items from `state.inventory` (`squads/inventory-loadout.ts`; the web payload only carries health), and `close` spends the consumed items itself (`ITEM_CONSUMED`). Hand changes in a battle are not engine moves: `MOVE_ITEM`/`AUTO_PLACE_ITEM` touching a hand answer `HANDS_LOCKED` while `inventoryContext.battleOpen` is set, and the web first pays for the change with the battle `set-hands`, then commits the move with `battleOpen` false.
- **Server (I5):** the gateway (`apps/api/src/game/command-guard.ts`) binds every inventory command to the hero the client controls and refuses `GRANT_ITEM`/`CONSUME_ITEM` from clients. The server state has no `inventory` yet, so inventory commands there answer `NO_INVENTORY`.

## Player aggregates (`src/aggregates/`, D1 of `docs/player-persistence-plan.md`, 2026-11-09)

- The server stores a hero as JSON **aggregates** (`inventory`, minimal `progress { claimedRewards }`), listed in `AGGREGATES` with `schemaVersion`, a strict Zod `schema`, `upcasters`, `createInitial` (empty) and `project`. A new kind of progress = one definition + commands here; the API does not change. `upcastAggregate` brings a stored document to the current version.
- **Player commands** (`PLAYER_COMMAND_SCHEMAS`, strict envelope + payload): the inventory transfers, `CLAIM_CAMP_CHEST` (inventory + progress in one step, `claimedRewards: ['camp-first-chest']` stops a second claim) and the fixture-only (`e2eFixturesEnabled()`, never production) `DEV_GRANT_ITEM`, `DEV_CONSUME_ITEM`, `DEV_SET_INVENTORY` (temporary until the world commands run on the server, D2). `PLAYER_COMMAND_AGGREGATES` names what each command touches in lock order. `GRANT_ITEM` / `CONSUME_ITEM` have no client route; server code uses `grantItemServerSide` / `consumeItemServerSide`.
- `executePlayerCommand(aggregates, command, { devGrantAllowed, inventory })` is pure and returns `{ ok, changed, events }` or `{ ok: false, code }`; a rejection event (`ITEM_TRANSFER_REJECTED`, `ITEM_GRANT_REJECTED`, `ITEM_CONSUME_REJECTED`, `REWARD_REJECTED`) becomes the code. The API turns `ITEM_GRANTED` / `ITEM_CONSUMED` / `STASH_CHEST_UNLOCKED` / `INVENTORY_REPLACED` events into ledger rows.

- **Where the hero stands (SG, 2026-11-10):** the server never passes `stashOpen: true`; it passes `serverInventoryContext(progress.presence)` (`aggregates/server-inventory-context.ts`), i.e. `standsNextToCampObject(place, 'stash-chest')` from `content/boards/camp-object-spot.ts`. `campObjectSpots(key)` reads the object's hex from `CAMPING_BOARD` (legend symbol), so moving the chest in the drawing moves the rule with it; "next to" = one of the six neighbours in `camping`, never the object hex itself, `null` presence or another location = false. Reuse it for any camp object the server must guard (the trader stall in SH2). The Book of Will stays on `standsAtCampBook`, because the Book is installed by `installCampBook`, not drawn.
- **Progress commands (D2):** `execute-progress-command.ts` runs `KNOWLEDGE`, `SACRIFICE_TO_SKILL`, `RESET_SKILLS`, `ARRIVE`, `SPEND_WILL` (+ dev `DEV_GRANT_WILL`, `DEV_SET_KNOWLEDGE`) over `ProgressState { claimedRewards, knowledge, presence, steps }`. The knowledge context is built by `serverKnowledgeContext(presence)`, never read from the payload. `PLAYER_COMMAND_REVISION` says what `payload.revision` means per command (`aggregate`, `knowledge` or `none`). Nested objects of a command schema are not strict, so a rule must never read a field the schema does not declare (a `cost` is ignored on purpose).

## The world on the server (`src/world/`, D4b-A, 2026-11-09)

`ServerWorld` is one map plus the hero's place, the dice seed and the engagement. Build it with `createServerWorld` (seed from the expedition, never from a player), save it with `serializeWorld`, and run `stepWorld` / `actWorld` / `tickWorld` over a `WorldRun { world, progress, inventory, heroId, now, client? }`; they return a new progress and inventory plus `tileDiffs` and `effects`, and refuse with a code without changing anything. They mutate the passed world in place, so load a fresh copy per command. The ports come from `createRecordingPorts(hint)` (`world/server-ports.ts`): instead of touching stores they record `WorldEffect`s (`lockTool`, `unlockTool`, `consumeDurability`, `stopTool`, `clearResolvedActions`, `setActiveTool`, `treeCut`, `stones`, `gather`, `log`, `heal`) that the client replays on its real stores; durability always holds, there is no battle. The fire's rest loop reads the optional `client` hint (`{ tool: { dragging, hover, active, durability? }, health: { current, max } }`, only on `WORLD_ACTION`/`WORLD_TICK`), so health is trusted from the client until D4b-3. A command refused by the Will, the distance or a missing tile returns no effects; an `ACTION_REJECTED` returns the effects the starter had already recorded (a broken tool: wear and the fall back to the hand). `HexMapModel.fromJSON(raw, now, { keepUseActions: true })` keeps a pending rest; the server world and `applyTileDiffs` use it, the client's own load does not. Strict command schemas are in `WORLD_COMMAND_SCHEMAS`.

`travelWorld(run, via)` (`world/travel.ts`) is the server's location change: `via` is `{ kind: 'exit' }` (board edge, atlas neighbour) or `{ kind: 'gate', coordinates }` (the gate's Will is charged by the same `actWorld(ENTER)`). `TravelRun` adds `loadStored(locationKey)` and `create(locationKey)`; the outcome carries the origin, the destination, a `replaced` fresh dungeon, the new progress (`presence`, `sealedUntil`) and the events. `progress` is v3: `sealedUntil` (location to time) and `portal` (reserved for the server portal).

The portal is server-held: `openPortalWorld`, `enterPortalWorld` and `closePortalWorld` (`world/portal-world.ts`) run the engine's `OPEN_PORTAL`/`ENTER_PORTAL` over `ServerWorld`s with `progress.portal` as the hero's link; a command that closes a pair must return every changed map (`touched`, via `removeClosedPortals` in `world/world-leave.ts`), because a client that is not told keeps a stale copy. `TravelRun` and `PortalRun` need `loadById` besides `loadStored`/`create`.

Health is in `progress.health` (`{ current, bonus, debt }`, base `HERO_BASE_HEALTH`): world commands build a `HeroModel` from it (`heroModelOf`) and write it back, the fire's heal therefore needs no client hint; `executePlayerCommand` re-derives `bonus` from the equipped items after every inventory change, which is why every inventory command lists `'progress'` in `PLAYER_COMMAND_AGGREGATES` (a command that may change another aggregate must lock it, or the change is lost). `DEV_SET_HEALTH` is an e2e fixture only (gated like every `DEV_*`).

## Battle on the server (`src/world/battle-world.ts`, D4b-4 B1, 2026-11-10)

`battleWorld(run, payload)` runs the `WORLD_BATTLE` command (`start | hero | run-enemy-turn | close | sync`, strict schema, no `atMs`, no `heroes`) over a `ServerWorld` that now has `battle: BattleState | null`. The clock is `run.now`; the hero is built from `progress.health` + `inventory`; `progress.health.current = hp / 2` after every step; `progress.kills` is added on `close` (progress v5). Overdue things are settled lazily before the command (window/task after `deadline + rules.networkGraceMs`, an enemy turn after `rules.enemyTurnDueMs` from `BattleState.turnClockMs`, played once at `atMs = now`). The answer is `steps[]` of `{ events, battle }` already projected for `heroes` (no raw events leave the engine); `set-hands` is applied to `inventory.equip` in the same step (`battle-hands-sync.ts`). `stepWorld`/`actWorld`/travel/portal refuse with `BATTLE_OPEN` while a battle is open. `projectBattleForViewer` also hides `taskHistory`, `wounds`, `turnClockMs`, enemy `bag`; `world/client-projection.ts` hides an unscouted squad's members and loot in maps and `tileDiffs` (the API must call it, B3).

**Client view of a world (`projectWorldForClient`):** hides unscouted squad members and loot, drops the battle, and replaces `worldSeed` and `descriptor.seed` with `cosmeticSeedFor(seed)` (a hash), so the client never holds the seed the server rolls loot, arrivals and ambushes from. `world/world-fixtures.ts` (`applyWorldFixture`, `place-hexobject`) is the e2e-only way to put an object next to the hero on the server map.
