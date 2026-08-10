import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import { MISSING_TEST_HOOKS_MESSAGE, type TestHexCoordinates } from '@framework/test-api';
import { TileDetailsOverlayComponent } from '@components/tile-details-overlay.component';

/**
 * The PixiJS board. Nothing here re-derives hex geometry: neighbours,
 * distances and click positions all come from the running app via
 * `window.__HEXOFLAT_TEST__` (apps/web/src/e2e/), which is the app's own
 * engine code. The previous version of this file mirrored the engine's
 * odd-q math by hand, and that copy went stale silently whenever the real
 * formula moved.
 */

const HERO_MOVE_TIMEOUT_MS = 1_500;
const POLL_INTERVALS_MS = [100];

/**
 * How long to let the app settle before asserting on a *settled* hero
 * position. bootstrapWorld() re-places and re-saves the hero on every boot,
 * so a wrong placement can land a beat after the board first reports ready —
 * `expect.poll` would stop at the first (still-correct) reading and never see
 * it. A single check after this window is what observes settled state.
 */
const HERO_POSITION_SETTLE_MS = 1_000;

function coordinateKey(coordinates: TestHexCoordinates | null): string {
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : 'none';
}

export class HexBoardComponent extends BaseComponent {
  private readonly tileDetails = new TileDetailsOverlayComponent();

  private get canvas() {
    return this.page.getByTestId('hex-board-canvas');
  }

  private get sceneRoot() {
    return this.page.getByTestId('map-scene-root');
  }

  private get board() {
    return this.page.getByTestId('hex-map');
  }

  /**
   * Waits on the board's own readiness signal instead of guessing: the
   * `data-ready` attribute flips only after PixiJS presents its first
   * fully-synced frame (see hex-world-map.vue), and the hero coordinates
   * poll covers the world bootstrap that follows.
   */
  async waitForReady(): Promise<void> {
    await expect(this.sceneRoot).toBeVisible();
    await expect(this.canvas).toHaveAttribute('data-ready', '1');
    await this.verifyTestHooksAreInstalled();
    await expect
      .poll(() => this.getHeroCoordinates(), { intervals: POLL_INTERVALS_MS })
      .not.toBeNull();
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.board).toBeVisible();
  }

  private async verifyTestHooksAreInstalled(): Promise<void> {
    const installed = await this.page.evaluate(() => Boolean(window.__HEXOFLAT_TEST__));
    if (!installed) throw new Error(MISSING_TEST_HOOKS_MESSAGE);
  }

  async getHeroCoordinates(): Promise<TestHexCoordinates | null> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHeroCoordinates());
  }

  async requireHeroCoordinates(): Promise<TestHexCoordinates> {
    const coordinates = await this.getHeroCoordinates();
    if (!coordinates) throw new Error('The hero has no coordinates on the board yet.');
    return coordinates;
  }

  async getNeighbors(coordinates: TestHexCoordinates): Promise<TestHexCoordinates[]> {
    return this.page.evaluate(
      (coord) => window.__HEXOFLAT_TEST__!.getNeighbors(coord),
      coordinates,
    );
  }

  async getDistance(from: TestHexCoordinates, to: TestHexCoordinates): Promise<number> {
    return this.page.evaluate(([a, b]) => window.__HEXOFLAT_TEST__!.getDistance(a, b), [
      from,
      to,
    ] as const);
  }

  async getTileHexobjectKey(coordinates: TestHexCoordinates): Promise<string | null> {
    return this.page.evaluate(
      (coord) => window.__HEXOFLAT_TEST__!.getTileHexobjectKey(coord),
      coordinates,
    );
  }

  /**
   * Translates a tile to a click position: the app reports the tile centre as
   * a fraction of the board's box, which is then scaled by the canvas's live
   * bounding box — so this stays correct through the page's CSS zoom without
   * knowing anything about it.
   */
  private async tilePosition(coordinates: TestHexCoordinates): Promise<{ x: number; y: number }> {
    const fraction = await this.page.evaluate(
      (coord) => window.__HEXOFLAT_TEST__!.getTileFraction(coord),
      coordinates,
    );
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('hex-board-canvas has no bounding box — is the map rendered?');

    return { x: fraction.fx * box.width, y: fraction.fy * box.height };
  }

  async clickTile(coordinates: TestHexCoordinates): Promise<void> {
    await this.canvas.click({ position: await this.tilePosition(coordinates) });
  }

  async hoverTile(coordinates: TestHexCoordinates): Promise<void> {
    await this.canvas.hover({ position: await this.tilePosition(coordinates) });
  }

  /** Arms the hero's default HAND tool (both equip slots default to it for a fresh hero). */
  async armHandTool(): Promise<void> {
    await this.canvas.hover();
    await this.page.mouse.wheel(0, 100);
  }

  private async waitForHeroCoordinates(
    matches: (coordinates: TestHexCoordinates) => boolean,
  ): Promise<TestHexCoordinates> {
    await expect
      .poll(
        async () => {
          const coordinates = await this.getHeroCoordinates();
          return coordinates ? matches(coordinates) : false;
        },
        { timeout: HERO_MOVE_TIMEOUT_MS, intervals: POLL_INTERVALS_MS },
      )
      .toBe(true);

    return this.requireHeroCoordinates();
  }

  /** Clicks one adjacent, currently-walkable tile and waits for the hero to actually step onto it. */
  async moveOneStep(): Promise<TestHexCoordinates> {
    const from = await this.requireHeroCoordinates();
    const fromKey = coordinateKey(from);

    for (const candidate of await this.getNeighbors(from)) {
      await this.clickTile(candidate);
      await this.tileDetails.closeIfOpen();
      try {
        return await this.waitForHeroCoordinates(
          (coordinates) => coordinateKey(coordinates) !== fromKey,
        );
      } catch {
        // Solid/occupied/out of bounds — try the next direction.
      }
    }

    throw new Error(
      `Hero at (${from.columnIndex}, ${from.rowIndex}) could not step onto any of its 6 neighbours.`,
    );
  }

  /**
   * Walks the hero, one hex per click (a fresh hero's scout rank only grants
   * one move step — packages/engine's scout-progression.ts), until it stands
   * next to `target`. Direction is chosen greedily by hex distance; a blocked
   * neighbour falls through to the next-best one, so this never needs the
   * map's full collision layout up front.
   */
  async moveAdjacentTo(target: TestHexCoordinates, maxSteps = 20): Promise<void> {
    for (let step = 0; step < maxSteps; step += 1) {
      const from = await this.requireHeroCoordinates();
      const distanceToTarget = await this.getDistance(from, target);
      if (distanceToTarget <= 1) return;

      const neighbors = await this.getNeighbors(from);
      const ranked = (
        await Promise.all(
          neighbors.map(async (candidate) => ({
            candidate,
            distance: await this.getDistance(candidate, target),
          })),
        )
      )
        .filter((entry) => entry.distance < distanceToTarget)
        .sort((a, b) => a.distance - b.distance);

      let moved = false;
      for (const { candidate } of ranked) {
        const candidateKey = coordinateKey(candidate);
        await this.clickTile(candidate);
        await this.tileDetails.closeIfOpen();
        try {
          await this.waitForHeroCoordinates(
            (coordinates) => coordinateKey(coordinates) === candidateKey,
          );
          moved = true;
          break;
        } catch {
          // Blocked — try the next-best direction toward the target.
        }
      }

      if (!moved) {
        throw new Error(
          `Stuck at (${from.columnIndex}, ${from.rowIndex}) — no forward neighbour toward ` +
            `(${target.columnIndex}, ${target.rowIndex}) was walkable.`,
        );
      }
    }

    throw new Error(`Did not reach a tile adjacent to the target within ${maxSteps} steps.`);
  }

  async verifyHeroMovedAwayFrom(previous: TestHexCoordinates): Promise<void> {
    expect(coordinateKey(await this.getHeroCoordinates())).not.toBe(coordinateKey(previous));
  }

  /**
   * Asserts the *settled* hero position, not a transient one — see
   * HERO_POSITION_SETTLE_MS. `expect.poll` is deliberately the wrong tool
   * here: it would stop at the first matching reading and miss a wrong
   * placement landing moments later.
   */
  async verifyHeroSettledAt(expected: TestHexCoordinates): Promise<void> {
    await this.page.waitForTimeout(HERO_POSITION_SETTLE_MS);
    expect(await this.getHeroCoordinates()).toEqual(expected);
  }

  async verifyTileHoldsHexobject(
    coordinates: TestHexCoordinates,
    hexobjectKey: string,
  ): Promise<void> {
    await expect
      .poll(() => this.getTileHexobjectKey(coordinates), { intervals: POLL_INTERVALS_MS })
      .toBe(hexobjectKey);
  }

  /**
   * A finished TAKE clears the tile for non-RESOURCE items (no respawn) — see
   * `consumeTileHexobject` in the engine's action-finishers-registry.ts. The
   * action is completed by the 250ms world tick loop (world-map-store.ts's
   * startWorldLoop), so this is never instant.
   */
  async verifyTileIsCleared(coordinates: TestHexCoordinates): Promise<void> {
    await expect
      .poll(() => this.getTileHexobjectKey(coordinates), {
        timeout: 5_000,
        intervals: POLL_INTERVALS_MS,
      })
      .toBeNull();
  }
}
