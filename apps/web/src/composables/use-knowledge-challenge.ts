import { computed, ref, watch } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';
import { routeToLocation } from '@/services/world/location-navigator';
import { knowledgePanelMode } from './use-knowledge-panel';
import { correctCount, reviewQuestions } from '@hexoflat/engine/knowledge/state';
import { accuracy, grade, KNOWLEDGE_RULES } from '@hexoflat/engine/knowledge/math';
import type { KnowledgeAction } from '@hexoflat/engine/knowledge/commands';

export function useKnowledgeChallenge(recover = false) {
  const hero = useHeroStore();
  const world = useWorldMapStore();
  const combat = useCombatStore();
  const busy = ref(false);
  const rejected = ref(false);
  const session = computed(() => hero.knowledge?.session ?? null);
  const active = computed(() =>
    session.value?.mode === knowledgePanelMode.value &&
    !['done', 'returned'].includes(session.value.status)
      ? session.value
      : null,
  );
  const hall = computed(() => (active.value?.mode === 'hall' ? active.value : null));
  const ret = computed(() => (active.value?.mode === 'return' ? active.value : null));
  const question = computed(() =>
    hall.value ? hall.value.question : ret.value?.questions[ret.value.index],
  );
  const selectedAnswer = computed(() =>
    hall.value ? hall.value.answer : (ret.value?.answers[ret.value.index] ?? null),
  );
  const correct = computed(() => (ret.value ? correctCount(ret.value) : 0));
  const percent = computed(() => accuracy(correct.value));
  const gradeKey = computed(() => `knowledge.grades.${grade(correct.value)}`);
  const review = computed(() =>
    ret.value?.status === 'result' && correct.value < 17
      ? reviewQuestions(ret.value)[ret.value.reviewIndex]
      : null,
  );
  const canAssist = computed(
    () =>
      (hero.knowledge?.failedReturns ?? 0) >= KNOWLEDGE_RULES.assistedFailures &&
      ret.value?.reviewIndex === KNOWLEDGE_RULES.reviewCount,
  );

  async function send(action: KnowledgeAction) {
    if (busy.value) return;
    busy.value = true;
    try {
      rejected.value = !(await hero.knowledgeAction(action));
    } finally {
      busy.value = false;
    }
  }

  let returning = false;
  async function recoverReturn() {
    const pending = session.value;
    if (
      !recover ||
      returning ||
      !pending ||
      pending.status !== 'returning' ||
      !world.map ||
      combat.combatActive ||
      hero.isHeroMoving
    )
      return;
    if (world.currentLocationKey !== 'camping' && world.currentMapId !== pending.originMapId)
      return;
    returning = true;
    const heroId = hero.hero.id;
    try {
      // The durable "returning" record is the recovery journal. Repeating navigation
      // after a crash is safe; a "returned" record never moves the hero again.
      if (world.currentLocationKey !== 'camping') {
        world.goToLocation('camping');
        await routeToLocation('camping');
      }
      if (heroId !== hero.hero.id || session.value?.id !== pending.id) return;
      if (await hero.knowledgeAction({ kind: 'returned', sessionId: pending.id }))
        knowledgePanelMode.value = null;
    } finally {
      returning = false;
    }
  }

  watch(
    () => [session.value?.status, world.currentMapId, combat.combatActive],
    () => {
      void recoverReturn();
    },
    { immediate: true },
  );
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
    ret,
    question,
    selectedAnswer,
    correct,
    percent,
    gradeKey,
    review,
    canAssist,
    send,
  };
}
