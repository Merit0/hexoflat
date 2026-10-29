import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The deploy card shown between ATTACK on a squad and START BATTLE (battle-deploy-card.vue). */
export class BattleDeployCardComponent extends BaseComponent {
  private get card() {
    return this.page.getByTestId('battle-deploy-card');
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.page.getByTestId('battle-start')).toBeVisible();
  }

  async verifyIsHidden(): Promise<void> {
    await expect(this.card).toBeHidden();
  }
}
