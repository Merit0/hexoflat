import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import ActionAlertBanner from './action-alert-banner.vue';

let app: App;
let host: HTMLElement;

const banner = () => host.querySelector<HTMLElement>('[data-testid="action-alert-banner"]');

describe('action alert banner', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(ActionAlertBanner).use(pinia);
    app.mount(host);
  });
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('keeps showing a warning with the red mark and the Will icon as before', async () => {
    useHeroToolStore().setActionMessage('Not enough Will', 'will', 3);
    await nextTick();
    expect(banner()?.dataset.tone).toBe('warn');
    expect(banner()?.querySelector('.action-alert-mark')).not.toBeNull();
    expect(banner()?.querySelector('[data-testid="action-alert-will-icon"]')).not.toBeNull();
    expect(banner()?.querySelector('[data-testid="action-alert-will-cost"]')?.textContent).toBe(
      '3',
    );
  });

  it('shows the price with the coin sprite for a coin warning', async () => {
    useHeroToolStore().setActionMessage('Not enough coins to pay', 'coins', 100);
    await nextTick();
    const icon = banner()?.querySelector('[data-testid="action-alert-coins-icon"]');
    expect(icon?.getAttribute('src')).toContain('coin');
    expect(banner()?.querySelector('[data-testid="action-alert-will-icon"]')).toBeNull();
    expect(banner()?.textContent).toContain('(100)');
  });

  it('drops the red mark for a hint or a success', async () => {
    const tool = useHeroToolStore();
    tool.setActionMessage('Put coins in your hand', null, null, 'info');
    await nextTick();
    expect(banner()?.querySelector('.action-alert-mark')).toBeNull();
    expect(banner()?.classList.contains('is-info')).toBe(true);

    tool.setActionMessage('You unlock the stash chest', null, null, 'success');
    await nextTick();
    expect(banner()?.querySelector('.action-alert-mark')).toBeNull();
    expect(banner()?.classList.contains('is-success')).toBe(true);
  });

  it('goes back to a warning for the next plain message', async () => {
    const tool = useHeroToolStore();
    tool.setActionMessage('Done', null, null, 'success');
    tool.setActionMessage('Too far');
    await nextTick();
    expect(banner()?.dataset.tone).toBe('warn');
    tool.clearActionMessage();
    expect(tool.actionMessageTone).toBe('warn');
  });
});
