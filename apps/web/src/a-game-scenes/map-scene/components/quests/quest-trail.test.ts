import { describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import { i18n } from '@/i18n';
import QuestTrail from './quest-trail.vue';

describe('trail answer colors', () => {
  it('stays neutral until review arrives and colors each answer including the last chip', async () => {
    const props = reactive<{ numbers: number[]; answerReview?: boolean[] }>({ numbers: [2, 9, 6] });
    const host = document.createElement('div');
    const app = createApp({ setup: () => () => h(QuestTrail, props) }).use(i18n);
    app.mount(host);
    try {
      expect(host.querySelectorAll('.is-correct, .is-wrong')).toHaveLength(0);
      props.answerReview = [true, false, true];
      await nextTick();
      const chips = host.querySelectorAll('li');
      expect(chips[0].classList.contains('is-correct')).toBe(true);
      expect(chips[1].classList.contains('is-wrong')).toBe(true);
      expect(chips[2].classList.contains('is-correct')).toBe(true);
    } finally {
      app.unmount();
    }
  });
});
