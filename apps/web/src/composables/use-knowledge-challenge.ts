import { computed, ref, watch } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { knowledgePanelMode } from './use-knowledge-panel';
import type { KnowledgeAction } from '@hexoflat/engine/knowledge/commands';

export function useKnowledgeChallenge() {
  const hero = useHeroStore();
  const busy = ref(false);
  const rejected = ref(false);
  const session = computed(() => hero.knowledge?.session ?? null);
  const active = computed(() =>
    session.value?.mode === knowledgePanelMode.value && session.value.status !== 'done'
      ? session.value
      : null,
  );
  const hall = computed(() => (active.value?.mode === 'hall' ? active.value : null));
  const question = computed(() => hall.value?.question ?? null);
  const selectedAnswer = computed(() => hall.value?.answer ?? null);

  async function send(action: KnowledgeAction) {
    if (busy.value) return;
    busy.value = true;
    try {
      rejected.value = !(await hero.knowledgeAction(action));
    } finally {
      busy.value = false;
    }
  }

  watch(
    () => hero.hero.id,
    () => {
      knowledgePanelMode.value = null;
    },
  );
  return {
    hero,
    busy,
    rejected,
    session,
    active,
    hall,
    question,
    selectedAnswer,
    send,
  };
}
