import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export class QuestEntranceComponent extends BaseComponent {
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
    // The portal position is part of the public quest field projection.
    const field = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuestField());
    if (!field?.exit) throw new Error('No quest camping portal');
    return field.exit;
  }
}
