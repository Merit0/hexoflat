import { Graphics, Polygon, Sprite, Texture } from 'pixi.js';

/**
 * Mirrors --hex-clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)
 * from apps/web/src/assets/global.css — the single source of truth for the
 * flat-top hex silhouette every hex-shaped DOM element used to clip to.
 */
export function buildHexPolygon(width: number, height: number): Polygon {
  return new Polygon([
    width * 0.25,
    0,
    width * 0.75,
    0,
    width,
    height * 0.5,
    width * 0.75,
    height,
    width * 0.25,
    height,
    0,
    height * 0.5,
  ]);
}

export function createHexHitArea(width: number, height: number): Polygon {
  return buildHexPolygon(width, height);
}

export function drawHexMask(graphics: Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.poly(buildHexPolygon(width, height).points).fill(0xffffff);
}

export function createHexMask(width: number, height: number): Graphics {
  const graphics = new Graphics();
  drawHexMask(graphics, width, height);
  return graphics;
}

/**
 * Mirrors CSS `background-size: cover`: scales the sprite's texture
 * uniformly (preserving aspect ratio) so it fully covers the box, centers
 * it, and lets the caller crop the overflow via a mask — same two-step
 * "cover then clip-path" behavior the DOM version relied on. Without this,
 * setting `sprite.width`/`sprite.height` directly to the box size stretches
 * non-uniformly whenever the box aspect ratio (~1:0.89) differs from the
 * source image's own aspect ratio (often 1:1), visually squishing it.
 */
export function applyCoverFit(sprite: Sprite, boxWidth: number, boxHeight: number): void {
  // The DOM-probe measurement (boxWidth/boxHeight) and Pixi's own async init
  // resolve independently, so this can be called once before the probe has
  // measured anything (box 0x0). A 0x0 box would otherwise permanently zero
  // the sprite's scale — nothing "un-zeros" it later since scale 0 looks
  // identical to "not sized yet". Skip and wait for the next reactive sync
  // (triggered once the box size is actually known) instead.
  if (!boxWidth || !boxHeight) return;

  const texture = sprite.texture;

  if (texture === Texture.EMPTY || !texture.width || !texture.height) {
    sprite.width = boxWidth;
    sprite.height = boxHeight;
    sprite.position.set(0, 0);
    return;
  }

  const scale = Math.max(boxWidth / texture.width, boxHeight / texture.height);
  const width = texture.width * scale;
  const height = texture.height * scale;

  sprite.width = width;
  sprite.height = height;
  sprite.position.set((boxWidth - width) / 2, (boxHeight - height) / 2);
}
