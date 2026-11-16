import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestRenderStats } from '@framework/test-api';

type BoardKind = 'world' | 'quest' | 'battle';

export class ActiveBoardComponent extends BaseComponent {
  async verifyOnly(kind: BoardKind): Promise<void> {
    const world = this.page.getByTestId('hex-board-canvas');
    const quest = this.page.getByTestId('quest-field').locator('canvas');
    const battle = this.page.getByTestId('battle-board').locator('canvas');
    await expect(world.or(quest).or(battle)).toHaveCount(1);
    const canvas = { world, quest, battle }[kind];
    await expect(canvas).toBeVisible();
    const ready =
      kind === 'world'
        ? world
        : this.page.getByTestId(kind === 'quest' ? 'quest-field' : 'battle-board');
    await expect(ready).toHaveAttribute('data-ready', kind === 'world' ? '1' : 'true');
    await expect.poll(async () => (await this.readRenderStats()).liveApps).toBe(1);
  }

  async readRenderStats(): Promise<TestRenderStats> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getRenderStats());
  }

  async verifySharedTickerBackTo(baseline: number): Promise<void> {
    await expect
      .poll(async () => (await this.readRenderStats()).sharedTickerListeners, {
        message: 'animations left on the shared ticker after the board changed',
      })
      .toBeLessThanOrEqual(baseline);
  }

  async verifyHeroTokenSettled(): Promise<void> {
    await expect
      .poll(async () => (await this.readRenderStats()).heroTokenSettled, {
        message: 'the hero token reached the hex the hero stands on',
      })
      .toBe(true);
  }

  async waitForReady(): Promise<void> {
    await expect.poll(() => this.page.evaluate(() => Boolean(window.__HEXOFLAT_TEST__))).toBe(true);
    await expect(
      this.page
        .getByTestId('hex-board-canvas')
        .or(this.page.getByTestId('quest-field').locator('canvas'))
        .or(this.page.getByTestId('battle-board').locator('canvas')),
    ).toHaveCount(1);
    const kind = await this.page.evaluate(() => {
      const api = window.__HEXOFLAT_TEST__!;
      if (api.getQuestField()) return 'quest';
      return api.isBattleEngaged() ? 'battle' : 'world';
    });
    await this.verifyOnly(kind);
  }
}
