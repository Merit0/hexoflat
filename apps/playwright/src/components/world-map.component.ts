import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestHexCoordinates, TestWorldDescriptor } from '@framework/test-api';

const POLL_INTERVALS_MS = [100];

/** The generated world map: its descriptor and geometry, read via the test hook. */
export class WorldMapComponent extends BaseComponent {
  async getDescriptor(): Promise<TestWorldDescriptor | null> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getWorldDescriptor());
  }

  async requireDescriptor(): Promise<TestWorldDescriptor> {
    const descriptor = await this.getDescriptor();
    if (!descriptor) throw new Error('No world descriptor — this location is not generated.');
    return descriptor;
  }

  async waitForDescriptor(): Promise<void> {
    await expect.poll(() => this.getDescriptor(), { intervals: POLL_INTERVALS_MS }).not.toBeNull();
  }

  async getCampAnchorCoordinates(): Promise<TestHexCoordinates | null> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getCampAnchorCoordinates());
  }

  async requireCampAnchorCoordinates(): Promise<TestHexCoordinates> {
    const coordinates = await this.getCampAnchorCoordinates();
    if (!coordinates) throw new Error('The generated map has no camp anchor tile.');
    return coordinates;
  }

  async getHeroCoordinates(): Promise<TestHexCoordinates | null> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHeroCoordinates());
  }

  async getDistance(from: TestHexCoordinates, to: TestHexCoordinates): Promise<number> {
    return this.page.evaluate(([a, b]) => window.__HEXOFLAT_TEST__!.getDistance(a, b), [
      from,
      to,
    ] as const);
  }

  async verifyAccepted(): Promise<void> {
    const descriptor = await this.requireDescriptor();
    expect(descriptor.accepted, `rejection reasons scored ${descriptor.score}/6`).toBe(true);
  }

  async verifyHeroAdjacentToCampAnchor(): Promise<void> {
    const camp = await this.requireCampAnchorCoordinates();
    const hero = await this.getHeroCoordinates();
    if (!hero) throw new Error('The hero has no coordinates on the generated map.');
    expect(await this.getDistance(hero, camp)).toBe(1);
  }

  async verifyMatchesAfterReload(before: TestWorldDescriptor): Promise<void> {
    const after = await this.requireDescriptor();
    expect({
      seed: after.seed,
      archetype: after.archetype,
      versionId: after.versionId,
      hexCount: after.hexCount,
      branchCount: after.branchCount,
      promiseCount: after.promiseCount,
    }).toEqual({
      seed: before.seed,
      archetype: before.archetype,
      versionId: before.versionId,
      hexCount: before.hexCount,
      branchCount: before.branchCount,
      promiseCount: before.promiseCount,
    });
  }
}
