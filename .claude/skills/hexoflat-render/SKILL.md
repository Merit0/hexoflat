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
  enemy-vision-layer.ts
  combat-marker-layer.ts
  camp-heal-layer.ts
```

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
- **DOM overlays** (`tool-hex-tile`, dev coordinate labels, combat outline) live in `.hex-board-overlays`, translated by the camera offset. That container sets `--hex-tile-width/height` to the **on-screen** tile size (world × zoom), and children position themselves with `calcHexPixelPosition(coord, screenTileW, screenTileH)`. Never size an overlay from a global CSS variable or scale it with a CSS `transform: scale()` — that is what made overlays drift from the board before.
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
