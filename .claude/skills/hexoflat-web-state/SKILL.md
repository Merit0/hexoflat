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

- No direct `localStorage` in `world-map-store.ts`, `hero-inventory-store.ts`, `combat-store.ts` → use `services/persistence/*-storage.ts`.
  - Note: `hero-store.ts`, `user-store.ts`, `ui-settings-store.ts`, `game-events-store.ts` still use it directly by design and are exempt. Do not "consistently" migrate them as a side quest.
- No direct `Math.random()` in those same three stores → use the RNG port from `@hexoflat/engine/utils/random`.
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

## Other conventions

- Scenes live in `apps/web/src/a-game-scenes/<scene>/components/`. Shared UI in `apps/web/src/components/`.
- Display text goes through vue-i18n (`t()` / `$t()`), not literals. `@intlify/vue-i18n/no-raw-text` is currently enforced only on the three already-migrated files listed in `eslint.config.js`; new components should still follow the pattern.
- `overlay-store` is for genuinely modal things only.
- E2E hooks (`apps/web/src/e2e/`) are gated behind `import.meta.env.VITE_E2E_HOOKS !== 'true'` checked **inline**, so Vite can statically fold the branch away and keep the hooks out of production bundles. Keep the condition inline — do not extract it into a helper.

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
