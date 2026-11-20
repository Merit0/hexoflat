import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createKnowledgeState } from '@hexoflat/engine/knowledge/state';
import { generateHallQuestion } from '@hexoflat/engine/knowledge/math';
import { useHeroStore } from '@/stores/hero-store';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { i18n } from '@/i18n';
import KnowledgeBoard from './knowledge-board.vue';

describe('Hall reward feedback with Focus', () => {
  let app: App;
  let host: HTMLElement;
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const hero = useHeroStore();
    const question = generateHallQuestion('focus', 0, {}, []);
    hero.knowledge = {
      ...createKnowledgeState(hero.hero.id),
      current: 15,
      session: {
        id: 'hall',
        mode: 'hall',
        seed: 'focus',
        originMapId: 'camp',
        status: 'feedback',
        index: 0,
        question,
        answer: question.answer,
        correct: 1,
        earned: 5,
        lastAward: 5,
        lastFast: false,
        recent: [],
      },
    };
    knowledgePanelMode.value = 'hall';
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(KnowledgeBoard).use(pinia).use(i18n);
    app.mount(host);
  });
  afterEach(() => {
    app.unmount();
    host.remove();
    knowledgePanelMode.value = null;
  });

  it('does not call a slow +5 reward a quick answer', () => {
    const gain = host.querySelector('[data-testid="knowledge-gain"]');
    expect(gain?.textContent).toContain('5');
    expect(gain?.textContent).not.toContain(i18n.global.t('knowledge.fastBonus'));
  });

  it('shows the quick-answer label when the server marks the answer as fast', async () => {
    useHeroStore().knowledge!.session!.lastFast = true;
    await nextTick();
    expect(host.querySelector('[data-testid="knowledge-gain"]')?.textContent).toContain(
      i18n.global.t('knowledge.fastBonus'),
    );
  });
});
