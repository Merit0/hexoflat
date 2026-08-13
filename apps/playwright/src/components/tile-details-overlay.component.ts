import { BaseComponent } from '@framework/base-component';

/** The hex-tile details overlay (apps/web's hex-tile-details-overlay.vue). */
export class TileDetailsOverlayComponent extends BaseComponent {
  private get closeButton() {
    return this.page.getByTestId('tile-details-close-button');
  }

  /**
   * Clicking a tile that turns out to hold an object (a tool, the fireplace,
   * ...) doesn't move the hero — it opens this overlay instead (see
   * use-tile-click.ts). The overlay's backdrop then covers the whole board
   * and silently swallows every later canvas click, so any helper that tries
   * several candidate directions must close it between attempts.
   *
   * Deliberately tolerant: it's normal for the overlay not to be open at all.
   */
  async closeIfOpen(): Promise<void> {
    const isOpen = await this.closeButton.isVisible().catch(() => false);
    if (!isOpen) return;

    await this.closeButton.click();
    await this.closeButton.waitFor({ state: 'hidden' });
  }
}
