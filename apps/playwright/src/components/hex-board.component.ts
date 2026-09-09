import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import { MISSING_TEST_HOOKS_MESSAGE, type TestHexCoordinates } from '@framework/test-api';
import { TileDetailsOverlayComponent } from '@components/tile-details-overlay.component';

const HERO_MOVE_TIMEOUT_MS = 1_500;
const POLL_INTERVALS_MS = [100];
const TOOL_STATE_TIMEOUT_MS = 2_000;
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

  private async getToolHoverCoordinates(): Promise<TestHexCoordinates | null> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getToolHoverCoordinates());
  }

  async hoverTile(coordinates: TestHexCoordinates): Promise<void> {
    await this.canvas.hover({ position: await this.tilePosition(coordinates) });

    await expect
      .poll(() => this.getToolHoverCoordinates(), {
        timeout: TOOL_STATE_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toEqual(coordinates);
  }

  async armHandTool(): Promise<void> {
    await this.canvas.hover();
    await this.page.mouse.wheel(0, 100);

    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.isToolUsed()), {
        timeout: TOOL_STATE_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(true);
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
        } catch {}
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

  async verifyTileIsCleared(coordinates: TestHexCoordinates): Promise<void> {
    await expect
      .poll(() => this.getTileHexobjectKey(coordinates), {
        timeout: 5_000,
        intervals: POLL_INTERVALS_MS,
      })
      .toBeNull();
  }
}
