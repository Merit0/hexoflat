/**
 * Fixed board size for location maps (docs/WORLD-MAP-BOARDS-PLAN.md). The
 * board is a single screen-sized rectangle that must fit the `.hex-map` pane
 * at every panel state without clipping or scaling — there is no camera and
 * no scale-to-fit, so the constant has to be measured against the narrowest
 * case (hero board panel OPEN, 70% pane width) rather than derived from
 * silesia's current hand-authored size.
 *
 * Measured 23.09.2026 in a real browser (apps/web dev build, hero board
 * panel open) by reading `.hex-probe`'s `getBoundingClientRect()` (the same
 * box `--hex-tile-width`/`--hex-tile-height` resolve to) against `.map-pane`,
 * at the two most common desktop aspect ratios:
 *
 * | Viewport   | Aspect | tile px (w×h)   | pane px (w×h) | columns | rows |
 * | ---------- | ------ | --------------- | -------------- | ------- | ---- |
 * | 1440×900   | 16:10  | 54.87 × 63.36   | 1008 × 900     | 18      | 18   |
 * | 1920×1080  | 16:9   | 73.16 × 84.48   | 1344 × 1080    | 18      | 17   |
 *
 * Columns are resolution-independent by construction: both the tile width
 * and the pane width are pure `vw` values, so the ratio (pane is exactly
 * 70vw, tile width is `4.4vw * 0.866`) cancels the viewport width out —
 * `floor(70 / (4.4 * 0.866))` is 18 at any width. Rows are NOT
 * resolution-independent: tile height is sized in `vw` (not `vh`) while the
 * pane height tracks `100vh`, so row count depends on the viewport's aspect
 * ratio. BOARD_ROWS below takes the smaller of the two measured values so a
 * board generated for it never needs clipping on either aspect ratio.
 */
export const BOARD_COLUMNS = 18;
export const BOARD_ROWS = 17;

export const BOARD_CELL_COUNT = BOARD_COLUMNS * BOARD_ROWS;
