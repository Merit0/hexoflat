---
name: hexoflat-web-state
description: Where state belongs in apps/web — Pinia stores vs composables vs services — plus the target store contract and the ESLint size/complexity ratchet. Use when a task touches apps/web/src/stores/**, apps/web/src/composables/**, apps/web/src/services/**, adds UI state, wires a new mechanic into the frontend, or asks where some piece of frontend logic should live.
---

# State in `apps/web`

This file exists because `world-map-store.ts` grew to 914 lines and 32 actions before the G0–G6 refactor (`docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md`). The rules below are what stops that from happening again.

## The decision table — read this first

| The thing you are adding                      | Where it goes                         |
| --------------------------------------------- | ------------------------------------- |
| A game rule (what is legal, what happens)     | `packages/engine` — **never** a store |
| Reactive state the UI renders                 | Pinia store                           |
| UI-only state (drag, hover, zoom, panel open) | composable, **not** a store           |
| Talking to `localStorage` / API               | `apps/web/src/services/`              |
| Orchestration with animation/timing           | `apps/web/src/services/`              |
| Derived value from existing state             | `computed` in a composable            |

If you cannot place something with this table, that is a signal the feature is under-designed — ask rather than defaulting it into a store.

## The one rule that matters most

> **A new mechanic is written as an engine command. Never as a store action.**

The engine pipeline (`applyCommand` → domain events) is a parallel path that already works. New mechanics do not need to route through a store's action list.

**Signal lamp:** if adding a mechanic requires editing `world-map-store.ts`, stop and reconsider. It almost always means the mechanic is being modelled as UI state instead of as a game rule.

## Target store contract

A Pinia store here is a **read model plus an intent funnel** — a projection of state for the UI and a single entry point for user intent. It is not a domain object. It holds no rules.

Target shape for `world-map-store` (documented in full in Part 6 of `docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md`):

- **Holds:** `map`, `locationKey`, `mapId`, `status`, `revision`
- **Does:** `open()`, `dispatch(command)`, `applyRemote(events)`, `close()` — plus getters
- **Knows about:** engine types + `applyCommand`, a repository port, an event sink. Nothing else.
- **Must not know:** `localStorage`, `router`, `setInterval`, any other Pinia store, or the words "fog" / "combat" / "inventory"

The current stores have not reached this shape. That is expected — the contract is the direction of travel and the acceptance test for new code, not a precondition. **New code should match it; old code is migrated opportunistically when a task already touches that area.** Do not open a standalone refactoring project to reach it.

## Hard bans (ESLint-enforced, so you will get an error, not a review comment)

- No direct `localStorage` in `world-map-store.ts`, `hero-inventory-store.ts` → use `services/persistence/*-storage.ts`.
  - Note: `hero-store.ts`, `user-store.ts`, `ui-settings-store.ts`, `game-events-store.ts` still use it directly by design and are exempt. Do not "consistently" migrate them as a side quest.
- No direct `Math.random()` in those same stores → use the RNG port from `@hexoflat/engine/utils/random`.
- `import-x/no-cycle` is `error` everywhere except the files in `KNOWN_CYCLE_FILES` in `eslint.config.js`. **Never add a file to that list to make an error go away** — it is a record of reviewed legacy cycles, not an escape hatch. A new cycle means the split is wrong.
- `max-lines`, `max-lines-per-function`, `complexity`, `max-depth` are pinned to current measured maximums. If a change trips one, split the code — do not raise the threshold.

## Known trap: extract, then actually wire it up

Three composables (`use-move-preview`, `use-hex-board-sizing`, `use-hex-board-input`) once existed with **zero importers** while duplicates of their logic stayed inline in `hex-world-map.vue` — two divergent copies of the same movement-preview rules, either of which could drift without anyone noticing.

After extracting anything, verify the old call site actually imports it and the inline copy is deleted.

## Worked example: the skill tree

- Rules and numbers live in the engine (`packages/engine/src/skills/`: statuses, sacrifice options, previews' maths). The web view-model `composables/skill-tree-view.ts` only shapes them for the UI — `buildSkillTreeView`, `findSkillNode`, `previewSacrifice` call engine functions and never recompute a price, status or option amount.
- User intent goes `component → emit → store action → knowledge-controller → applyCommand`: `hero-store.sacrificeToSkill` / `resetSkills` are the only funnel (`SACRIFICE_TO_SKILL`, `RESET_SKILLS`). Hovered option, selected node and "confirm reset" are component-local refs, not store state.
- Shared presentation data used by both the tree and the item tooltip (icons, school colors) sits in `components/gui/icons/skill-presentation.ts`, not inside a scene folder, so `components/gui` never imports from `a-game-scenes`.
- Texts looked up by id (`heroDetails.tree.node.<id>.*`) are invisible to the literal-`t('…')` scan; they are registered for the orphan-key test in `i18n/locale-keys.ts` (`collectSkillTreeLocaleKeys`). New id-driven keys need the same treatment.

## Worked example: the battle tab (B5)

- `stores/battle-store.ts` is the store contract in practice: it holds the battle (single-player, the web is authoritative), a `deploy` (setup + zones before START BATTLE), `localHeroIds`, the last hero batch (`lastHeroEvents`, for the hint line and defend results) and an event `queue` for animations (`takeEvents()`). Its actions only send `BATTLE` commands (`act`, `actAll` for multi-step paths, `runEnemyTurn`) or `startBattle`; no rule, no timer, no other store. `projection` is always `projectBattleForViewer(battle, 'heroes')`, and queued events go through `projectBattleEvent`, so the hidden strike side never reaches the UI.
- The view-model is pure and unit-tested: `composables/battle-view.ts` (`buildBattleView` — rows, initiative chips, deploy card, task, board scene + overlay + banner), `battle-hero-card.ts` (DEFEND / ACT / WAIT / FALLEN / victory / defeat card, hands, actions), `battle-hint.ts` (events → i18n message descriptors `{ key, params }`), `battle-board-tap.ts` (board tap → `BattleAction[]` by phase and mode, reading prices from engine `cheapestPaths`/`stepCost`). `use-battle-view.ts` wires them to the store and i18n and owns the UI-only state (mode, chosen hand, swap hand) as a module-level `reactive`, so the tab and the board share it.
- Message params whose value starts with `battle.` or `content.` are translated before formatting (`useBattleText().text`). Id-driven battle keys (tags, roles, hands, actions, hints, rejections, task titles, legend) are registered for the orphan-key test through `battleLocaleKeys()` in `battle-hint.ts`; a new dynamic key goes there.
- Timing is outside the store: `services/battle/use-battle-enemy-driver.ts` runs the enemy turn after `ENEMY_TURN_DELAY_MS` (mounted in `hero-board-panel.vue` and on `/dev/battlefield`), and `battle-timed-task.vue` sends `task-timeout` when its line runs out.
- The BATTLE tab exists only while `battleStore.isOpen`; opening switches the panel to it, closing goes back to HERO.

## Worked example: squads on the map (B6b)

- "Is a battle on?" is `battleStore.inBattle` (an engagement or a deploy exists); hero-store, world-map-store, portal, crossing and the tool tile all read that one flag, and pass it to the engine as `combatActive`.
- `battle-store` stays a leaf: it holds `engagement` + `battle`, `snapshot()`/`restore()` for saves, and a `BattleEngineBridge` (`bindBridge`). With a bridge bound, `send`/`start`/`leave` go through it, so a map battle runs through `applyCommand` with the world state; `/dev/battlefield` binds nothing and plays fight commands locally.
- A squad is a hexobject, so there is no squad store. Squad actions come from the normal tool hex: `tool-hex-tile.vue` shows exactly ONE action — the top-priority one (Oleh's atomic-actions rule; no button lists, no multi-action picker until Oleh decides) — and calls `worldMapStore.executeHexAction`, which goes through `heroStore.startHexAction` → `dispatchHexAction(host, command, held)` in `knowledge-controller.ts` (`held` = battle + engagement from `battle-store`; the engagement that comes back is written to `battle-store`). `executeHexAction` returns the events; on a squad tile the menu passes them to `applySquadEvents` for logs and the translated `squad.rejected.*` message.
- `services/squads/squad-flow.ts`: `useSquadFlow()` (mounted once in `hex-world-map.vue`) binds the battle bridge (`start` / `close` as `BATTLE` lifecycle kinds), rebuilds the deploy card from `engagement` by a watch (also after a reload)). `applySquadEvents`: `SQUAD_SCOUTED`/`AMBUSH` → log, `BATTLE_CLOSED` → hearts written back, consumed items taken, kills, defeat → `respawnHeroAtCamping`. `services/squads/squad-views.ts` (`useSquadViews`) gives only the watched hexes (on `dirtyTick`) for the watch layer. The EVENTS tab is only the event log, as on `game-dev-vite` — no squad list or price card (Oleh, 2026-10-29). `squad-loadout.ts` builds the battle hero from inventory (hands = `weapon`/`shield`, bag ≤ 3).
- **Battle turn statuses (Oleh, 2026-10-29): ACTION and MOVE.** `ui.stage` (`composables/battle-stage.ts`) is switchable freely (stage bar `battle-stage-bar.vue`, testids `battle-stage-<id>`) and a turn starts in MOVE. The mouse wheel (or a hand row) enters ACTION and then cycles every item in the hero's hands; the tool hex follows the hover and offers one action by the item: weapon / empty hand → Attack, shield → Block (a guard side beside the hero) / Lift, potion → Use. Tapping a board hex while in ACTION switches to MOVE and moves. The tool's `−` button (no action) closes it back to MOVE. The tool hex appears only after the wheel or a hand row in the card picks an item — the ACTION chip alone shows none. Hand rows and Push/Swap show only in ACTION, Undo only in MOVE. The engine does not enforce this order and enemy AI ignores it.
- **Hands follow the inventory in a battle (Oleh, 2026-10-30).** The hero's battle hands are built from the weapon/shield slots at START BATTLE only, so a change made later goes through a gate: `hero-inventory-store.moveItemToSlot` snapshots the items, applies the move, and when the weapon/shield keys changed asks `bindInventoryHandsGate` (bound in `useSquadFlow` by `services/battle/battle-hands-gate.ts`) to send `set-hands` (hexobject keys converted with `battleItemOfHexobject`); a refusal (not your turn, defend phase, 4 Will short, enemy animation) restores the snapshot and shows a warning. Outside a battle the gate lets everything through. The USE button on an equipped token (`equip-token.vue`) in a battle calls `activateBattleHand(right|left)` instead of the map tool.
- **Use price and defense mode (Oleh, 2026-10-31).** Consumable detection in battle composables uses `item.usePrice` (not `heal`), and prices come from the item, never from `BATTLE_RULES`. `battle-hero-card.ts` exposes `defenseMode` (act phase with a shield raised); `battle-hero-controls.vue` shows the tag, and the `DEFENSE_MODE` rejection goes through the shared warning banner.
- **Block window UI (Oleh, 2026-10-31).** `use-battle-reaction.ts` (called once from `battle-tab.vue`) owns the 5 s `reaction-timeout` timer, auto-selects the shield hand and shows the "under attack" banner. The hero card has `defend` and `aim` states with a CSS countdown bar (`deadlineMs`); the attacker sees decoy shield marks on the whole ring (`decoyShieldMarks`) and `target` marks on the aim options. Strike animations key off `STRIKE_LANDED`, not `STRIKE_DEALT`.
- **Battle card, cost, log, hero data (Oleh, 2026-10-31).** `nextActionCost` (`battle-next-cost.ts`) decides the Turn cost number: path price in MOVE, tool price in ACTION, never summed; `costTooHigh` turns it red. The hero card has no stage bar, defense tag, planned-cost line or swap button. `battle-event-log.ts` writes battle events to the Events tab (called from the squad bridge). `followBattleHealth` in `squad-flow.ts` keeps `heroStore` health equal to the battle hero after every command (battle max comes from `heroHpMax`). USE on a non-battle item in a battle shows `battle.warn.notInBattle` (`equip-token.vue`). The battle starts straight from ATTACK; the deploy card is gone. Hidden-tile look: `fogLookForBoardKind` (mist hex for dungeons, clouds elsewhere).
- **Input lock (fixed 2026-10-29):** the battle store locks hero input only while an ENEMY turn plays (`inputLocked` = `animating` && `enemyTurnPlaying`); the hero's own walk animation never drops clicks (it used to, so quick clicks were lost). `animating` alone still holds back the enemy turn. A click during the lock or on an enemy's turn shows a warning (`battle.warn.enemyTurn` / `NOT_YOUR_TURN`) through `useBattleWarnings().lockedWarning`.
- **Silent no-ops are bugs.** After an enemy strike the hero's next turn starts in the DEFEND phase (block / dodge / take the hit) and board taps cannot move him; a tap there shows `battle.warn.defendFirst`, a tap with a timed task open shows `TASK_OPEN`. Every `tapHex` path that does nothing must warn.
- **One warning system for refusals.** Every refused battle action (and an unaffordable move tap) goes through `composables/use-battle-warnings.ts` (`send` / `warn`) into `heroToolStore.setActionMessage`, the same banner the map uses (`action-alert-banner`); INSUFFICIENT_WILL shows the Will icon and price like the map. New refusals need only a `battle.reject.<CODE>` text. `TOO_HEAVY` reads "The enemy is quite heavy!".
- **Enemy row hands (2026-11-02).** `BattleCreatureRow.hands` (from `composables/battle-row-hands.ts`, pure and tested) lists the right and left hand as `{ hand, toolKey, itemKey }`; `battle-creature-row.vue` draws each with the prototype sprite of `toolKey` (`getPrototype(...).spritePath`), the sprite comes from the shared `battleToolKeyOf` (`render/battle/battle-tool-key.ts`, also used by the strike animation): enemy-only items fall back to the sword or shield sprite, an empty hand shows the bare hand. The row's hex token uses `plain` (board sprite, no frame). Add a real sprite for an enemy item by mapping it in `BATTLE_ITEM_BY_HEXOBJECT`, not in the row.
- **Tool hex closes after the last weapon (Oleh, 2026-11-02).** `actWithTool` (`use-battle-view.ts`) calls `hideToolWhenNoWeaponLeft` after an accepted attack: if `weaponHandsLeft` (`battle-tool-hex.ts`, pure, tested in `battle-tool-hex.test.ts`) is empty it goes back to the `move` stage. A bare hand never counts as a weapon; with two unused weapons the tool hex stays for the second hand. The hero's strike never waits for an aim stage (see the engine skill).
- **Battle hands = the tool hex, as on the map.** The mouse wheel over the battle board (`battle-board-area.vue`, same `HAND_SCROLL_COOLDOWN_MS` as the map) cycles the hero's usable hands (`cycleHand`: weapon / shield / empty hand) and shows that hand's tool hex; there is no Strike button in the card. A weapon or empty hand next to a foe offers one action, Attack (`battle.tool.attack`); the shield tool offers Block / Lift and a potion Use. The hero card shows the planned Will price `card.plan` (move preview cost + attack cost) at the Will bar; the battle move preview draws the path only (no end marker, no number). In STRIKE mode (hand picked) `composables/battle-tool-hex.ts` (`buildBattleToolHex`) puts the hand's tool hex next to the hero (follows hover, defaults to a foe's hex); its single action Strike sends `strike` for the foe on that hex. Tapping an enemy no longer strikes. An empty hand strikes for `BATTLE_RULES.unarmedPower` (half a heart). : `planFreeRoamRoute` returns `ambush` (the engagement from the planning state) and the route already ends on the watched hex; `moveHeroTo` calls `engageAmbush` when the walk reaches it.
- Saves: `TWorldState.battle` holds `{ engagement, battle }`, validated on load by `readBattleSnapshot` (Zod + `findSquad`).
- While a battle is open, `hex-world-map.vue` mounts `battle-board-area.vue` over the dungeon board; the dungeon map itself stays frozen.
- Dynamic squad keys (`squad.threat.*`, `squad.rejected.*`, action labels) are registered for the orphan-key test in `squadLocaleKeys()` (`i18n/locale-keys.ts`); squad titles are `content.<key>.title|tableRule`.

## Worked example: the hex hover card

Pure view model in `services/hex-info/build-hex-info.ts` (content -> `HexInfoView`, no Vue, covered by `build-hex-info.test.ts`); hover state in the composable `use-hex-hover-info.ts` (module-level `shallowRef`, set from `hex-world-map.vue` via the tiles-layer callbacks); the components in `components/gui/hex-info/` only render the view. New card fields go through the view model, and every `hexInfo.*` i18n key must be referenced literally or the ui.json key test fails. Engine content fields shown on the card (for example `weapon.radius`) need the Zod schema, the abstraction type and a rebuild of `packages/engine/dist`.

## Other conventions

- Scenes live in `apps/web/src/a-game-scenes/<scene>/components/`. Shared UI in `apps/web/src/components/`.
- Display text goes through vue-i18n (`t()` / `$t()`), not literals. `@intlify/vue-i18n/no-raw-text` is currently enforced only on the three already-migrated files listed in `eslint.config.js`; new components should still follow the pattern.
- `overlay-store` is for genuinely modal things only.
- E2E hooks (`apps/web/src/e2e/`) are gated behind `import.meta.env.VITE_E2E_HOOKS !== 'true'` checked **inline**, so Vite can statically fold the branch away and keep the hooks out of production bundles. Keep the condition inline — do not extract it into a helper.

## Layout width guards

- The map/hero-board split is `use-game-layout.ts` percentages only. Grid tracks in `hex-world-map.vue` are `minmax(0, var(--…))`, `.map-pane` and `.hero-board-panel` use `contain: inline-size` + `min-width: 0`, and `.hero-board-body` has an explicit `grid-template-columns: minmax(0, 1fr)`. Content wider than a pane is clipped, never stretches the layout. Do not use `contain: layout`/`paint` there (it makes the block the containing block for `position: fixed` descendants).
- Any `display: grid` inside the panel needs an explicit `minmax(0, …)` column; an implicit `auto` column grows to its content.
- Tab labels (`hero-board-panel.vue`) are plain text (no icon/dot); the font scales with the panel via a container query: `clamp(9px, 100cqw / tab-count / 7.5, 20px)`.

## Cursors

- Three custom cursors in `apps/web/public/cursors/app-cursor/`, wired only in `apps/web/src/assets/global.css`: `cursor-default.svg` for everything (including clickable things — there is no separate pointer cursor), `holy-cursor-open-hand-plane.svg` on hover over draggable things, `holy-cursor-grab-hand-plane.svg` while pressed / dragging.
- Make an element draggable-looking by adding the `cursor-grab` class (inventory and equip tokens do). Do not write `cursor: grab/grabbing` in scoped styles: the global rules are `!important` and win anyway.
- A drag that leaves the element keeps the closed hand via `html.is-grabbing`, toggled in `startInventoryDrag` / `resetInventoryDragState` (`composables/use-inventory-drag.ts`). A new pointer-based drag must toggle the same class.
- All three SVGs must stay the same size (48×48), share the same `viewBox` (`0 0 32 32`, one coordinate system) and the **same hotspot** (`3 0`). A different size, viewBox or hotspot makes the image jump when the cursor switches.
- The layered Inkscape source (all three hands as layers, with the dark outlines) is `apps/web/cursor-sources/app-cursors.inkscape.svg` — edit that, never the files in `public/`. To export: per cursor keep only its visible layer, delete hidden layers/images (`display:none` still gets downloaded), and downscale the embedded raster to ~250 px. A multi-MB cursor loads lazily on first hover and the browser shows its tiny native cursor until then; shipped cursors should be ~100 KB each.

## Checklist before finishing

- [ ] No game rule added to a store
- [ ] UI-only state lives in a composable, not Pinia
- [ ] No new import cycle; nothing added to `KNOWN_CYCLE_FILES`
- [ ] Persistence goes through `services/persistence/`
- [ ] Anything extracted is actually imported, and its inline twin is gone
- [ ] Lint passes without raising any threshold
