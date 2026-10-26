# Rarity of the Three Realms — implementation plan

Branch: `update-item-rarity-color-identifier-system` (already checked out).
Status: planned 2026-10-26. **Scope now: R1 + R3 only (rarity itself).** R2 (drop sets) is
deferred — design kept below for later. Ask before every commit.

## What stays as it is

The light sprite _behind_ the item (`apps/web/public/hex-assets/hex-frames/*-light.png`, drawn by
`tiles-layer.ts` → `node.frame`, `inventory-token.vue` → `.rarity-glow`, `hero-equip-board.vue`
→ `slotRarityStyle`) is the rarity identifier and already works. **Do not add a coloured hex
border.** Only the rarity _groups_, their names and two new light sprites change.

## The legend

Three rarity kinds — one per world — plus God Executor. Each world kind has two colours:
one for gear from ordinary creatures, one for gear from bosses. The boss/non-boss split has
**no name of its own**: the colour of the light already says it.

| Kind (`kind`)  | World                    | Name en / uk                     | Not boss                                                   | Boss                                          |
| -------------- | ------------------------ | -------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| `gloom`        | underground (dungeons)   | **Gloom** / **Морок**            | blue `#3E8BFF` · `blue-light.png`                          | violet `#A855F7` · `violet-light.png`         |
| `idol`         | earth (handmade, mortal) | **Idol** / **Кумир**             | gray `#A9AEB4` · `gray-light.png`                          | green `#4FD27A` · `green-light.png` **(new)** |
| `spark`        | heaven fields            | **Spark** / **Іскра**            | yellow `#F5D33B` · `yellow-light.png`                      | orange `#FF8A2A` · `orange-light.png`         |
| `god-executor` | any boss, very rare      | **God Executor** / **Кат Богів** | red `#FF3B3B` · `red-light.png` **(new)** — `boss` ignored |                                               |

Lore: Gloom is demon-made, Spark is angel-made. Mortals between them have no gods of their own, so they
make them by hand: Idol gear is humanity's false gods, crafted to rival the gear of demons and angels.
(Later design note, not in scope: Idol gear may grow through the hero's own work in camp.)

Rarity stays a **static property printed on the item's content** (physical-playability rule).

## R1 — engine: rarity shape + rules

`packages/engine/src/abstraction/hexobject-abstraction.ts`

- Replace `enum EEquipmentRarity { BASIC, COMMON, RARE, LEGEND, MYTHIC }` with:

```ts
export enum ERarityKind {
  GLOOM = 'gloom',
  IDOL = 'idol',
  SPARK = 'spark',
  GOD_EXECUTOR = 'god-executor',
}
export interface IItemRarity {
  kind: ERarityKind;
  boss: boolean; // ignored for GOD_EXECUTOR
}
```

- `rarity?: EEquipmentRarity` on tool / equipment / loot becomes `rarity?: IItemRarity`.
- Zod (`content-schema.ts`, 3 places): `rarity: z.object({ kind: z.enum(ERarityKind), boss:
z.boolean().default(false) }).optional()`.

New file `packages/engine/src/content/rarity-rules.ts`:

```ts
export const DEFAULT_RARITY: IItemRarity = { kind: ERarityKind.IDOL, boss: false };
/** Stable string id for a rarity — used as the key for colours, light sprites and i18n. */
export type TRarityTone =
  'gloom' | 'gloom-boss' | 'idol' | 'idol-boss' | 'spark' | 'spark-boss' | 'god-executor';
export function rarityTone(r: IItemRarity): TRarityTone; // god-executor ignores `boss`
```

Unit tests: `rarityTone` for all 7 tones; `boss: true` on god-executor still gives `'god-executor'`.

Defaults: today the fallback is duplicated with different values in `content-accessors.ts`
(`COMMON`), `item-tooltip.ts` `rarityOf` (`COMMON`/`BASIC`) and web `getObjectRarity`
(`COMMON`). All three use `DEFAULT_RARITY`.

`item-tooltip.ts` view: `rarity` becomes `IItemRarity`, plus `rarityTone: TRarityTone` for the UI.

Content re-grouping (every current item is earth gear):

| Item                      | Found in               | Old            | New                                      |
| ------------------------- | ---------------------- | -------------- | ---------------------------------------- |
| sword, shield             | camping                | default COMMON | `{ kind: IDOL, boss: false }` (explicit) |
| axe, pickaxe              | camping                | default COMMON | `{ kind: IDOL, boss: false }` (explicit) |
| hand                      | — (empty hand)         | BASIC          | `{ kind: IDOL, boss: false }`            |
| health/energy/mana bottle | silesia, silesia-north | BASIC          | `{ kind: IDOL, boss: false }`            |
| return scroll             | — (angelic teleport)   | RARE           | `{ kind: SPARK, boss: false }`           |

Write rarity explicitly on every equipment/tool/loot item, so new content can't silently fall back.

Saves: rarity is read from the prototype, not stored in saves → **no `CONTENT_VERSION` bump, no
migration**. Grep saves/persistence for `rarity` first to confirm.

## R3 — web: sprites, colours, labels

`apps/web/src/render/rarity.ts`

- `RARITY_FRAME_URLS: Record<TRarityTone, string>` and `RARITY_COLOR: Record<TRarityTone, string>`
  from the legend table. `getObjectRarity` returns `IItemRarity | null`; add
  `getObjectRarityTone(obj): TRarityTone | null` and use it in `tiles-layer.ts`,
  `inventory-token.vue`, `hero-equip-board.vue`, `hero-hands-section.vue`, `item-tooltip.vue`.
- Add `green-light.png` and `red-light.png` to `apps/web/public/hex-assets/hex-frames/`
  (512×512 RGBA radial lights, hue-shifted copies of `violet-light.png` — supplied with this plan).
- `item-icons.test.ts`: iterate the 7 tones (each colour `#RRGGBB`, each sprite URL exists).

i18n — `use-item-tooltip-labels.ts` + `locales/{en,uk}/ui.json`, key `itemTooltip.rarity`:

```json
"rarity": { "gloom": "Gloom", "idol": "Idol", "spark": "Spark", "god-executor": "God Executor" }
"rarity": { "gloom": "Морок", "idol": "Кумир", "spark": "Іскра", "god-executor": "Кат Богів" }
```

Labels are by `kind` only — the tooltip shows just the kind name; boss vs not is the light colour.
Drop `basic/common/rare/legend/mythic`.

Optional, same phase: the God Executor light gently pulses (alpha 0.75 ↔ 1, ~1.6 s) in
`tiles-layer.ts` and `.rarity-glow` — the only rarity that animates.

## Acceptance

- Camp gear and potions show the gray light and the label Кумир / Idol; the return scroll shows
  yellow and Іскра / Spark.
- Dev board panel: a test item of each of the 7 tones shows the right light, red one pulsing.
- `pnpm lint typecheck test` green; e2e untouched.

## R2 — creature drop sets (DEFERRED — do not implement now)

Decided 2026-10-26, for when drops get built (combat is still outside the engine):

- Every mob and boss owns a **predefined drop set** of concrete items:
  `drops: { item, weight }[]`, weights sum to **6** (a d6 table printed on the creature card).
- Creature gets `rank: 'mob' | 'boss'`; locations get required `locationType: 'earth' | 'dungeon'
| 'heaven'` (camping, silesia, silesia-north → earth; cave → dungeon).
- Validation test: every dropped item's rarity is `{ kind: kindFor(locationType), boss: rank ===
'boss' }` (dungeon → gloom, earth → idol, heaven → spark); a creature placed on a board has
  that board's `locationType`.
- God Executor is in **no** drop set: one global rule — after any boss drop, a second roll
  (physical: two d6, double six = 1/36). Shared God Executor item pool.

## Prompt for Claude Code

> Read `docs/RARITY-REALMS-PLAN.md` (copy of this plan) and implement phases R1 and R3 only on
> branch `update-item-rarity-color-identifier-system`. R2 is deferred — don't touch creatures,
> maps or drops. Keep the existing light-sprite rendering; only reshape rarity to
> `{ kind, boss }`, rename the groups to Gloom / Idol / Spark / God Executor and use the two new
> sprites `green-light.png` / `red-light.png` already in `hex-frames/`. Follow the hexoflat-engine
> skill for engine changes. Ask before every commit.
