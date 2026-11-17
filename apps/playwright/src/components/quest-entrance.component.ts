import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHexCoordinates, TestTerrainHex } from '@web-test-api';

export type QuestOrigin = {
  marker: TestHexCoordinates;
  hero: TestHexCoordinates;
  terrain: TestTerrainHex[];
};

function sortTerrain(cells: TestTerrainHex[]): string[] {
  return cells.map(({ hex, terrain }) => `${hex.columnIndex},${hex.rowIndex}:${terrain}`).sort();
}

export class QuestEntranceComponent extends BaseComponent {
  async readWorldHexSpacing() {
    const box = await this.page.getByTestId('hex-board-canvas').boundingBox();
    if (!box) throw new Error('World canvas is not mounted');
    const spacing = await this.page.evaluate(() => {
      const api = window.__HEXOFLAT_TEST__!;
      return (
        api.getTileFraction({ columnIndex: 1, rowIndex: 0 }).fx -
        api.getTileFraction({ columnIndex: 0, rowIndex: 0 }).fx
      );
    });
    return spacing * box.width;
  }

  async verifyQuestHexSpacing(expected: number) {
    await expect
      .poll(() =>
        this.page.evaluate(() => {
          const api = window.__HEXOFLAT_TEST__!;
          const a = api.getQuestHexPoint(0, 0);
          const b = api.getQuestHexPoint(1, 0);
          return a && b ? b.x - a.x : null;
        }),
      )
      .toBeCloseTo(expected, 2);
  }

  async verifyToolBesideQuestHero() {
    await expect
      .poll(() =>
        this.page.evaluate(() => {
          const api = window.__HEXOFLAT_TEST__!;
          const field = api.getQuestField();
          const hover = api.getToolHoverCoordinates();
          return (
            !!field &&
            !!hover &&
            api
              .getNeighbors(field.position)
              .some(
                (hex) => hex.columnIndex === hover.columnIndex && hex.rowIndex === hover.rowIndex,
              )
          );
        }),
      )
      .toBe(true);
    await expect(this.page.getByTestId('quest-tool-hex')).toBeVisible();
  }

  async readOrigin(marker: TestHexCoordinates): Promise<QuestOrigin> {
    const origin = await this.page.evaluate(() => {
      const api = window.__HEXOFLAT_TEST__!;
      return { hero: api.getHeroCoordinates(), terrain: api.getImpassableTerrain() };
    });
    if (!origin.hero) throw new Error('The hero is not on the world map');
    expect(origin.terrain.length).toBeGreaterThan(0);
    return { marker, hero: origin.hero, terrain: origin.terrain };
  }

  async verifyClonedField(origin: QuestOrigin) {
    const field = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuestField());
    if (!field) throw new Error('No quest run is open');
    expect(field.border).toEqual([{ hex: origin.marker, objectKey: 'camping-entrance' }]);
    expect(field.exit).toEqual(origin.marker);
    expect(field.position).toEqual(origin.hero);
    expect(field.chest).toBeNull();
    expect(field.ground).toHaveLength(0);
    expect(sortTerrain(field.terrain)).toEqual(sortTerrain(origin.terrain));
  }

  async freeNeighbour(): Promise<TestHexCoordinates> {
    const hex = await this.page.evaluate(() => {
      const api = window.__HEXOFLAT_TEST__!;
      const field = api.getQuestField();
      if (!field) return null;
      const taken = new Set(
        [field.exit, ...field.terrain.map((cell) => cell.hex)].flatMap((at) =>
          at ? [`${at.columnIndex},${at.rowIndex}`] : [],
        ),
      );
      return (
        api
          .getNeighbors(field.position)
          .find((at) => !taken.has(`${at.columnIndex},${at.rowIndex}`)) ?? null
      );
    });
    if (!hex) throw new Error('No free hex beside the quest hero');
    return hex;
  }

  async verifyNoObjectTooltip() {
    await expect(this.page.getByTestId('hex-info-tooltip')).toHaveCount(0);
  }

  async verifyDoorTooltip() {
    await expect(this.page.getByTestId('hex-info-tooltip')).toHaveCount(1);
    await expect(this.page.getByTestId('hex-info-title')).toHaveText(/Camping|Табір/i);
  }

  async verifyNoActionOffered() {
    await expect(
      this.page.getByTestId('quest-tool-hex').getByTestId('tool-action-button'),
    ).toHaveCount(0);
    await expect(
      this.page.getByTestId('quest-tool-hex').getByTestId('tool-hide-button'),
    ).toBeVisible();
  }

  async find() {
    const points = await this.page.evaluate(() =>
      window.__HEXOFLAT_TEST__!.findTilesWithKey('treasure-map'),
    );
    expect(points).toHaveLength(1);
    return points[0];
  }

  async approachRoute() {
    const marker = await this.find();
    const route = await this.page.evaluate((target) => {
      const api = window.__HEXOFLAT_TEST__!;
      return (
        api
          .getNeighbors(target)
          .map((hex) => api.getWalkRoute(hex))
          .filter((path) => path !== null)
          .sort((a, b) => a.length - b.length)[0] ?? null
      );
    }, marker);
    if (!route) throw new Error('No walkable route to the quest entrance');
    return { marker, route };
  }

  async verifyQuestTabs() {
    for (const tab of ['hero', 'inventory', 'quest', 'events'])
      await expect(this.page.getByTestId(`hero-board-tab-${tab}`)).toBeVisible();
    await expect(this.page.getByTestId('hero-board-tab-path')).toBeHidden();
    await expect(this.page.getByTestId('hero-board-tab-quest')).toHaveClass(/is-active/);
  }

  async verifyFieldClosed() {
    await expect(this.page.getByTestId('quest-field')).toBeHidden();
  }

  async verifyQuestUrl() {
    await expect(this.page).toHaveURL(/\/world\/treasure-seeker-map$/);
  }

  async exitPoint() {
    const field = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuestField());
    if (!field?.exit) throw new Error('No quest camping portal');
    return field.exit;
  }
}
