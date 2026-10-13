import { computed, ref, watch } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';
import { routeToLocation } from '@/services/world/location-navigator';
import { knowledgePanelMode } from './use-knowledge-panel';
import { correctCount, reviewQuestions } from '@hexoflat/engine/knowledge/state';
import { accuracy, grade, reward, KNOWLEDGE_RULES } from '@hexoflat/engine/knowledge/math';
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
    !['claimed', 'returned'].includes(session.value.status)
      ? session.value
      : null,
  );
  const question = computed(() => active.value?.questions[active.value.index]);
  const correct = computed(() => (session.value ? correctCount(session.value) : 0));
  const percent = computed(() => accuracy(correct.value));
  const gradeKey = computed(() => `knowledge.grades.${grade(correct.value)}`);
  const award = computed(() =>
    hero.knowledge ? reward(correct.value, hero.knowledge.current, hero.knowledge.capacity) : 0,
  );
  const review = computed(() =>
    active.value?.status === 'result' && correct.value < 17
      ? reviewQuestions(active.value)[active.value.reviewIndex]
      : null,
  );
  const canAssist = computed(
    () =>
      (hero.knowledge?.failedReturns ?? 0) >= KNOWLEDGE_RULES.assistedFailures &&
      active.value?.reviewIndex === KNOWLEDGE_RULES.reviewCount,
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
    question,
    correct,
    percent,
    gradeKey,
    award,
    review,
    canAssist,
    send,
  };
}
