---
name: hexoflat-render
description: How the PixiJS hex-board renderer is wired in apps/web/src/render — layers, the dirty-tile flush, world-unit hex sizing with the board camera, and the board-ready signal. Use when a task touches apps/web/src/render/**, adds or changes a visual layer on the hex board, deals with tile sprites, hex pixel geometry, canvas sizing or scaling, or when something renders in the wrong place or not at all.
---

# The hex-board renderer

PixiJS renders the board. Vue owns the surrounding DOM and feeds the renderer reactive inputs. The seam between them is `apps/web/src/render/use-hex-board.ts`.

## Layout of `apps/web/src/render/`

```
pixi-app.ts          bootstrap of the Pixi Application
use-hex-board.ts     the Vue<->Pixi seam; owns all layer lifecycles
board-camera.ts      world hex size, fit/follow camera, world->screen mapping
hex-geometry.ts      hex pixel math
texture-cache.ts     texture reuse
token-utils.ts       token drawing helpers
tile-dirty-tracker.ts  which tiles changed since the last flush
layers/
  tiles-layer.ts          the board itself
  hero-layer.ts
  move-preview-layer.ts
  squad-watch-layer.ts     thin highlight of the hexes a watcher squad sees (squads themselves are hexobjects drawn by tiles-layer with the `creature` fit)
  camp-heal-layer.ts
```

## The battle board (`render/battle/`)

The battle board has its own seam, `render/battle/use-battle-board.ts`, separate from `use-hex-board.ts`: the dungeon map stays frozen in `world-map-store` during a battle (R-FIELD-5), and the battle board renders straight from the engine battle state. Layers: `layers/battle-board-layer.ts` (tiles drawn exactly like map tiles — hex mask + the biome's floor sprite, cover fit; pillars and boulders use the `stone-wall`/`rock` `spritePath` from `CONTENT`; rubble/ledge/oil/saw are temporary token SVGs in `public/hex-assets/battle-tokens/`; the saw token spins on the ticker only while the layer is visible. Never draw procedural terrain or invent a look — reuse the map's sprites, Oleh's design is fixed), `layers/battle-token-layer.ts` (shared hex token per creature + hearts, no rims), `layers/battle-overlay-layer.ts`, and the map's own `layers/move-preview-layer.ts` for movement: no prices on reachable hexes; hovering a hex shows the path and the total Will cost on the final hex only, like moving on Silesia (`battleMovePreview` in `composables/battle-board-tap.ts`). Overlays come from the pure `battle-overlay-model.ts`, which reads only `projectBattleForViewer` (never the hidden strike side) and is unit-tested; colours live in `battle-look.ts`. Battle hexes are axial and reach pixels through `battleHexToOffset` + `calcHexPixelPosition`, so they share world units with the map. Input: tiles in `battle-board-layer` are the only hit targets (`onHexTap` in the layer deps → `battle-board.vue` emits `hex-tap`); the overlay and token containers are `eventMode = 'none'` so they never swallow a tap. The gold glow on targeted tokens comes from `BattleOverlayModel.targets` (creature ids), passed to `battle-token-layer.sync`. `battle-board.vue` has a default slot drawn over the canvas — the timed-task window lives there. `/dev/battlefield` (dev build only) plays a whole battle: deploy card, START BATTLE, the BATTLE tab beside the board.

### How a sprite sits in a hex cell — by hexobject group

`render/object-fit.ts` is the only place that decides it: `HEXOBJECT_FIT_RULES` maps each `EHexobjectGroup` to its rule — `creature`, `construction` (incl. `resource`), `pickup` (`loot`/`tool`/`equipment`, 0.7 of the cell, centred). `applyObjectFit(sprite, w, h, group)` is used by `tiles-layer` (incl. squad tokens), `battle-board-layer` (walls, boulders, rubble/ledge/oil/saw as `CONSTRUCTION`) and `hex-token` (`CREATURE`). Change a rule there, never per layer.

### Battle camera = map zoom

The battle board is drawn at the zoom of the map it came from: `fitAtReferenceZoom` in `board-camera.ts`, fed by `battle-board-area`'s `referenceFrame` (the current map frame in `hex-world-map.vue`, the cave model frame on `/dev/battlefield`). A hex is the same size on screen on the map and on the battle board.

### Creature tokens — one component

Every creature (hero on the map, squads on the dungeon map, heroes and enemies on the battle board) is drawn by `render/hex-token.ts` (`createHexToken`): a hex mask + the sprite cover-fit to the whole cell, body pivoted at the centre. No borders, rims, glows or stack shadows on creature hexes. Sprites come from one map, `creatureSprite(side, kind)` in `render/creature-sprites.ts` (hero `human-hex.png`, skeleton king `enemy-assets/boss-hex-images/skeleton-king-hex.png`, other enemies `enemy-assets/enemies-sprites/skeleton-hex.png`; all 512×512 from Inkscape). Never size or frame a creature differently from the hero.

### Battle animations (B7)

- **Every duration lives in `render/battle/battle-timing.ts`** (`BATTLE_TIMING`, incl. the enemy-turn pause the driver uses; `BATTLE_MOTION` for amplitudes). Never hard-code a millisecond value in a layer or service.
- **Source = `battleStore.takeEvents()` only** (already projected, so an enemy strike has `fromHex: null`). `use-battle-board.ts` takes the queue in `syncAll`, after the tokens are synced to the _final_ state; events queued before the Pixi app exists are discarded.
- Pipeline, all pure and unit-tested except the last two: `battle-animation-plan.ts` (events + final creatures → steps; positions are rewound from the final state through each event's `from`) → `battle-animation-sample.ts` (step + progress → token pose / strike fx) → `battle-animation-queue.ts` (plays steps in order, holds a token at its pre-step pose until its turn) → `battle-animator.ts` (ticker glue) → `battle-token-layer.pose()` + `layers/battle-fx-layer.ts`.
- **Engine never waits.** State is already final; poses are drawn over it. The token layer keeps a `Map` of tokens and re-applies poses after every `sync`, so an overlay redraw mid-animation does not snap a token.
- **One overlay recipe for every board:** DOM things over a Pixi canvas (the tool hex, later anything else) live in `components/gui/board/board-overlay-layer.vue`, which applies `boardOverlayStyle(camera, frameRect)` (`render/board-overlay-style.ts`) — the same div the Silesia map uses. Inside it the tool hex is `gui/tool-hex/tool-hex-anchor.vue` (position + flip from offset coords and `tileScreenSize`) around `tool-hex-face.vue` (look). The map's `tool-hex-tile.vue` and the battle's `battle-tool-hex.vue` only supply data. Never compute `camera.x + …` by hand in a component. The battle board hands its camera out through `onCamera` (read-only).
- **Every creature walks the same way:** each `CREATURE_MOVED` (hero or enemy) is one `walk` step of `BATTLE_TIMING.stepMs` (190 ms, easeOutCubic — the Silesia hero step). A strike is one `strike` step of `BATTLE_TIMING.strikeMs` (2000 ms, a deliberate pause): the sword flies from the attacker's own hex to the target with the ring lit, then the hit shake. Oleh asked to see enemy moves and hits (2026-10-29), so the old hidden enemy path (`vanish`/`appear`) is gone.
- **Input lock:** the board emits `animating` → `battleStore.setAnimating`; `act` refuses everything except `answer-task`/`task-timeout`, and `needsEnemyTurn` is false, so `use-battle-enemy-driver` starts its pause only after the animation ends. `battle-board` exposes `data-animating` for e2e.

## The contract

`useHexBoard(options)` takes reactive inputs (`ComputedRef`/`Ref`) and callbacks — never raw values. Adding a visual feature means:

1. A new file in `layers/` exporting `createXLayer(...)` returning a layer object with a `sync(...)` method, matching the existing layers' shape.
2. A new entry in `UseHexBoardOptions`, passed as a `ComputedRef`.
3. Lifecycle wiring in `use-hex-board.ts` (create, `sync` on watch, destroy on unmount).

Do not reach into Pinia stores from inside a layer. Layers receive data; the seam reads the stores. (`use-hex-board.ts` itself does import two stores today — that is existing wiring, not a pattern to copy into new layers.)

## Dirty-tile flushing — the part that bites

Deep-watching the whole tiles array on every mutation is too expensive, so the board tracks which tiles changed:

- Mutating code calls `markTileDirty` / `markTilesDirty` / `markAllTilesDirty` on `world-map-store`.
- Those add ids to `tile-dirty-tracker.ts` and bump a shallow `dirtyTick` counter.
- The tiles-layer watcher watches `dirtyTick` (cheap), then calls `consumeDirtyTileIds()` to get the set and clear it.

**The trap:** this is hand-maintained. Mutate a tile without marking it dirty and the change is invisible on screen until something else forces a redraw — with no error anywhere. Any new code path that mutates tiles must mark them.

Use `markAllTilesDirty()` as the safety net whenever the exact changed set is not cheaply knowable (fresh map, load from storage, a `WORLD_TICK` reporting `changed` with no per-tile detail, location switch).

> Direction of travel: `dirtyTick` is a lossy re-derivation of information the engine already emits as domain events, and the plan is to drive the renderer from the event stream instead. Until that happens, keep marking tiles.

## Sizing: world units + a camera

There is exactly one source of truth for hex size: `HEX_WORLD_WIDTH`/`HEX_WORLD_HEIGHT` in `render/board-camera.ts`. Every layer draws in these fixed world units (`getTileSize()` returns the constant); nothing reads a CSS variable or measures a DOM element to learn the tile size.

- **Canvas = the whole stage, camera = the pane.** `useBoardCamera` (`composables/use-board-camera.ts`) measures the `.hex-map` pane (for the camera) and the scene root (for `canvasSize`). The canvas is as wide as the stage and clipped by the pane's `overflow: hidden`, so it only resizes when the window does — the hero panel's 260 ms collapse transition moves the camera, never the canvas. The canvas buffer never grows with the board.
- **Resizing clears the WebGL buffer.** `renderer.resize()` resets the canvas, and the `ResizeObserver` fires after the ticker has already rendered that frame — so without an immediate render the frame is painted blank. `use-hex-board.ts` therefore applies resize + camera and calls `renderNow()` in the same watcher, and `resize()` skips no-op sizes. Keep them together.
- **Camera offsets are snapped to device pixels** (`snapCameraToPixels`, applied once in `useBoardCamera` so Pixi and the DOM overlays get the same value); fractional offsets make textures shimmer while the camera slides.
- **Camera = `worldContainer` transform.** `fitBoardCamera()` is a pure function: zoom fits the whole board frame into the pane, clamped to `[MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM]`. When the board fits, it is centered; when `MIN_CAMERA_ZOOM` keeps it bigger than the pane, the camera follows the hero and is clamped so no gap opens past the frame edge. `setCamera()` applies it to `worldContainer`.
- **DOM overlays** (`tool-hex-tile`, dev coordinate labels) live in `.hex-board-overlays`, translated by the camera offset. That container sets `--hex-tile-width/height` to the **on-screen** tile size (world × zoom), and children position themselves with `calcHexPixelPosition(coord, screenTileW, screenTileH)`. Never size an overlay from a global CSS variable or scale it with a CSS `transform: scale()` — that is what made overlays drift from the board before.
- **e2e** reaches tiles through `getTileFraction()` in `e2e/create-test-api.ts`, which maps a tile center through the same camera (`worldToScreen`). Any new geometry the tests need must go through the camera too.

Pane measurement has the same race the old tile probe had: a single read can land before layout settles and return 0. Keep the `ResizeObserver` plus the bounded polling fallback in `useBoardCamera`. **Do not replace it with a one-shot measurement.**

## `onBoardReady`

"Vue mounted" is a much weaker signal than "the board is interactive" — Pixi init and the pane measurement both resolve asynchronously afterwards. `onBoardReady` fires once the renderer has presented its first frame with every layer synced, and drives the `data-ready` attribute the e2e suite waits on. Anything that needs a usable board must wait for this, not for `onMounted`.

## Checklist before finishing

- [ ] New visual = new layer file + `UseHexBoardOptions` entry + lifecycle wiring
- [ ] Layers receive data; they do not read Pinia
- [ ] Every new tile mutation path marks tiles dirty
- [ ] Hex size comes only from `board-camera.ts`; overlays position through the camera; pane `ResizeObserver` left intact
- [ ] Anything gating on board readiness uses `onBoardReady`, not `onMounted`
