import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** Uncaught exceptions of the page — a render loop that throws leaves a blank board. */
export class PageErrorsComponent extends BaseComponent {
  private readonly errors: string[] = [];

  watch(): void {
    this.page.on('pageerror', (error) => this.errors.push(error.message));
  }

  async verifyNone(): Promise<void> {
    expect(this.errors).toEqual([]);
  }
}
