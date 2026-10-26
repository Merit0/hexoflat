import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import { MISSING_TEST_HOOKS_MESSAGE, type TestHexCoordinates } from '@framework/test-api';
import { TileDetailsOverlayComponent } from '@components/tile-details-overlay.component';

const HERO_MOVE_TIMEOUT_MS = 1_500;
const POLL_INTERVALS_MS = [100];
const TOOL_STATE_TIMEOUT_MS = 2_000;
const HERO_POSITION_SETTLE_MS = 1_000;

export type ExitSide = 'N' | 'S' | 'W' | 'E';

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

  /**
   * When a tool arms right next to its target, the interactions resolver's
   * default hover pick (the hero's first neighbour) can already land on
   * that same tile — the tool-hex-tile overlay's action button then sits
   * exactly on the pixel this method needs to move the mouse to, and a real
   * `.hover()` there gets stuck retrying against its own button forever.
   * Skip the physical move when the target is already hovered; the poll
   * below still confirms it.
   */
  async hoverTile(coordinates: TestHexCoordinates): Promise<void> {
    const current = await this.getToolHoverCoordinates();
    if (!current || coordinateKey(current) !== coordinateKey(coordinates)) {
      await this.canvas.hover({ position: await this.tilePosition(coordinates) });
    }

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

  async hoverNeighborWithKey(hexobjectKey: string): Promise<void> {
    const from = await this.requireHeroCoordinates();
    for (const candidate of await this.getNeighbors(from)) {
      if ((await this.getTileHexobjectKey(candidate)) === hexobjectKey) {
        await this.hoverTile(candidate);
        return;
      }
    }
    throw new Error(`No neighbouring hex holds "${hexobjectKey}".`);
  }

  async getFreeNeighbors(): Promise<TestHexCoordinates[]> {
    const from = await this.requireHeroCoordinates();
    const free: TestHexCoordinates[] = [];
    for (const candidate of await this.getNeighbors(from)) {
      if ((await this.getTileHexobjectKey(candidate)) === null) free.push(candidate);
    }
    return free;
  }

  async clickTileAndDismissDetails(coordinates: TestHexCoordinates): Promise<void> {
    await this.clickTile(coordinates);
    await this.tileDetails.closeIfOpen();
  }

  async tryStepAndVerifyBlocked(): Promise<void> {
    const from = await this.requireHeroCoordinates();
    for (const candidate of await this.getNeighbors(from)) {
      await this.clickTile(candidate);
      await this.tileDetails.closeIfOpen();
    }
    expect(coordinateKey(await this.getHeroCoordinates())).toBe(coordinateKey(from));
  }

  async moveAdjacentTo(target: TestHexCoordinates, maxSteps = 20): Promise<void> {
    for (let step = 0; step < maxSteps; step += 1) {
      const from = await this.requireHeroCoordinates();
      const distanceToTarget = await this.getDistance(from, target);
      if (distanceToTarget <= 1) return;

      // Clicking an occupied tile opens details rather than moving. Read
      // candidates together from the app instead of probing each object
      // with a click followed by a guaranteed movement timeout.
      const scored = await this.page.evaluate(
        ({ from, target }) => {
          const api = window.__HEXOFLAT_TEST__!;
          return api
            .getNeighbors(from)
            .filter(
              (candidate) =>
                api.getTileHexobjectKey(candidate) === null &&
                !api.isTileImpassableTerrain(candidate),
            )
            .map((candidate) => ({ candidate, distance: api.getDistance(candidate, target) }));
        },
        { from, target },
      );

      // Prefer a step that strictly closes the distance; only fall back to a
      // same-distance "lateral" step (detouring around a solid obstacle —
      // e.g. the camping map's fireplace sitting on the one direct approach)
      // once none of those land. Ties are tried in getNeighbors' own order.
      const closer = scored
        .filter((entry) => entry.distance < distanceToTarget)
        .sort((a, b) => a.distance - b.distance);
      const lateral = scored.filter((entry) => entry.distance === distanceToTarget);

      let moved = false;
      for (const { candidate } of [...closer, ...lateral]) {
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
          `Stuck at (${from.columnIndex}, ${from.rowIndex}) — no forward or lateral neighbour ` +
            `toward (${target.columnIndex}, ${target.rowIndex}) was walkable.`,
        );
      }
    }

    throw new Error(`Did not reach a tile adjacent to the target within ${maxSteps} steps.`);
  }

  async walkTo(target: TestHexCoordinates): Promise<void> {
    const route = await this.page.evaluate(
      (to) => window.__HEXOFLAT_TEST__!.getWalkRoute(to),
      target,
    );
    if (!route?.length)
      throw new Error(`No walkable route to (${target.columnIndex}, ${target.rowIndex}).`);

    for (const [index, step] of route.entries()) {
      await this.clickTile(step);
      if (index === route.length - 1) return;
      const stepKey = coordinateKey(step);
      await this.waitForHeroCoordinates((coordinates) => coordinateKey(coordinates) === stepKey);
    }
  }

  async requireExitTile(side: ExitSide): Promise<TestHexCoordinates> {
    const exit = await this.page.evaluate(
      (wanted) => window.__HEXOFLAT_TEST__!.getExitTile(wanted),
      side,
    );
    if (!exit) throw new Error(`The board has no ${side} exit.`);
    return exit;
  }

  async verifyHeroBesideExit(side: ExitSide): Promise<void> {
    const exit = await this.requireExitTile(side);
    await expect
      .poll(
        async () => {
          const hero = await this.getHeroCoordinates();
          return hero ? this.getDistance(hero, exit) : null;
        },
        { timeout: HERO_POSITION_SETTLE_MS * 3, intervals: POLL_INTERVALS_MS },
      )
      .toBe(1);
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

  async getTilesWithKey(hexobjectKey: string): Promise<TestHexCoordinates[]> {
    return this.page.evaluate(
      (key) => window.__HEXOFLAT_TEST__!.findTilesWithKey(key),
      hexobjectKey,
    );
  }

  async requireSingleTileWithKey(hexobjectKey: string): Promise<TestHexCoordinates> {
    await this.verifyTileCountWithKey(hexobjectKey, 1);
    return (await this.getTilesWithKey(hexobjectKey))[0];
  }

  async verifyTileCountWithKey(hexobjectKey: string, count: number): Promise<void> {
    await expect
      .poll(async () => (await this.getTilesWithKey(hexobjectKey)).length, {
        timeout: 5_000,
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(count);
  }

  async verifyLocation(locationKey: string): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getCurrentLocationKey()), {
        timeout: 10_000,
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(locationKey);
  }

  async verifyHeroBesideTile(coordinates: TestHexCoordinates): Promise<void> {
    await expect
      .poll(
        async () => {
          const hero = await this.getHeroCoordinates();
          return hero ? this.getDistance(hero, coordinates) : null;
        },
        { timeout: 5_000, intervals: POLL_INTERVALS_MS },
      )
      .toBe(1);
  }

  async hoverPortalTarget(): Promise<{ target: TestHexCoordinates; oneWay: boolean }> {
    const from = await this.requireHeroCoordinates();
    for (const candidate of await this.getNeighbors(from)) {
      const preview = await this.page.evaluate(
        (coord) => window.__HEXOFLAT_TEST__!.previewPortalOpening(coord),
        candidate,
      );
      if (!preview.ok) continue;
      await this.hoverTile(candidate);
      return { target: candidate, oneWay: preview.oneWay };
    }
    throw new Error('No neighbouring hex accepts a portal.');
  }

  async hoverPortalTargetRefusedAs(reason: string): Promise<void> {
    const from = await this.requireHeroCoordinates();
    for (const candidate of await this.getNeighbors(from)) {
      const preview = await this.page.evaluate(
        (coord) => window.__HEXOFLAT_TEST__!.previewPortalOpening(coord),
        candidate,
      );
      if (preview.reason !== reason) continue;
      await this.hoverTile(candidate);
      return;
    }
    throw new Error(`No neighbouring hex is refused as ${reason}.`);
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
