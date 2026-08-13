---
name: hexoflat-render
description: How the PixiJS hex-board renderer is wired in apps/web/src/render — layers, the dirty-tile flush, DOM size probing, and the board-ready signal. Use when a task touches apps/web/src/render/**, adds or changes a visual layer on the hex board, deals with tile sprites, hex pixel geometry, canvas sizing or scaling, or when something renders in the wrong place or not at all.
---

# The hex-board renderer

PixiJS renders the board. Vue owns the surrounding DOM and feeds the renderer reactive inputs. The seam between them is `apps/web/src/render/use-hex-board.ts`.

## Layout of `apps/web/src/render/`

```
pixi-app.ts          bootstrap of the Pixi Application
use-hex-board.ts     the Vue<->Pixi seam; owns all layer lifecycles
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

## Sizing: the DOM probe

Tile size is measured from a hidden DOM probe element, not hardcoded. A single `requestAnimationFrame` read is **not** reliable — if layout has not settled on that exact frame, the probe measures 0 once and nothing retries, leaving `domTileW/H` (and therefore `mapBounds`, canvas size, and every tile's hit area) stuck at zero for the life of the page. Tiles then render in the wrong place or clicks silently do nothing until a reload happens to win the race.

The existing fix is a `ResizeObserver` on the probe plus a bounded polling fallback. **Do not replace it with a one-shot measurement.**

## `onBoardReady`

"Vue mounted" is a much weaker signal than "the board is interactive" — Pixi init and the DOM probe both resolve asynchronously afterwards. `onBoardReady` fires once the renderer has presented its first frame with every layer synced, and drives the `data-ready` attribute the e2e suite waits on. Anything that needs a usable board must wait for this, not for `onMounted`.

## Checklist before finishing

- [ ] New visual = new layer file + `UseHexBoardOptions` entry + lifecycle wiring
- [ ] Layers receive data; they do not read Pinia
- [ ] Every new tile mutation path marks tiles dirty
- [ ] Probe/`ResizeObserver` sizing logic left intact
- [ ] Anything gating on board readiness uses `onBoardReady`, not `onMounted`
