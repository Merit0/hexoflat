import { describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import BoardCloseButton from './board-close-button.vue';

describe('BoardCloseButton', () => {
  function mount(onClose: () => void) {
    const host = document.createElement('div');
    createApp(BoardCloseButton, { testid: 'x-close', label: 'Close it', onClose }).mount(host);
    return host.querySelector<HTMLButtonElement>('[data-testid="x-close"]')!;
  }

  it('is a labelled cross button that tells its board to close', async () => {
    let closed = 0;
    const button = mount(() => (closed += 1));
    await nextTick();
    expect(button.textContent?.trim()).toBe('×');
    expect(button.getAttribute('aria-label')).toBe('Close it');
    expect(button.getAttribute('type')).toBe('button');
    button.click();
    expect(closed).toBe(1);
  });
});
