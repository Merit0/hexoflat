<template>
  <section
    ref="panel"
    class="knowledge-board"
    :class="{ 'is-start': !active }"
    tabindex="-1"
    data-testid="knowledge-board"
    :aria-label="t('knowledge.title')"
  >
    <img
      v-if="active"
      class="board-emblem"
      src="/hex-assets/hex-constructs/open-book-table-token-image.png"
      alt=""
      aria-hidden="true"
    />
    <knowledge-help :text="t('knowledge.hallLore')" />
    <header>
      <h2>{{ t('knowledge.title') }}</h2>
      <button
        type="button"
        class="close-btn"
        data-testid="knowledge-close"
        :aria-label="t('knowledge.close')"
        @click="closeKnowledgePanel()"
      >
        ×
      </button>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <p v-if="hero.knowledgeError" role="alert">{{ t('knowledge.saveError') }}</p>
    <template v-if="hero.knowledge">
      <knowledge-will-meter :current="hero.knowledge.current" :capacity="hero.knowledge.capacity" />
      <hr class="rule" />
      <template v-if="!active">
        <div class="start-stack">
          <div class="start-book">
            <img class="start-hex" :src="bookImage" alt="" aria-hidden="true" />
            <button
              type="button"
              class="eye-start"
              data-testid="knowledge-start"
              :aria-label="t('tool.read')"
              :title="t('tool.read')"
              :disabled="busy || hero.knowledgeError || full"
              :aria-describedby="full ? 'knowledge-entry-message' : undefined"
              @click="start"
            >
              <eye-icon />
            </button>
          </div>
        </div>
        <p v-if="full" id="knowledge-entry-message">
          {{ t('knowledge.full') }}
        </p>
      </template>
      <template v-else-if="question && ['question', 'feedback'].includes(active.status)">
        <h3 class="question" data-testid="knowledge-question">{{ expression(question) }} = ?</h3>
        <div class="answers">
          <button
            v-for="(option, i) in question.options"
            :key="option"
            type="button"
            :data-testid="`knowledge-answer-${i}`"
            :class="{
              'is-correct': active.status === 'feedback' && option === question.answer,
              'is-wrong':
                active.status === 'feedback' &&
                option === selectedAnswer &&
                option !== question.answer,
            }"
            :disabled="busy || active.status === 'feedback'"
            @click="
              send({
                kind: 'answer',
                sessionId: active.id,
                questionId: question.id,
                answer: option,
                elapsedMs: Date.now() - shownAt,
              })
            "
          >
            {{ option
            }}<span
              v-if="active.status === 'feedback' && option === question.answer"
              class="check"
              aria-hidden="true"
            >
              ✓</span
            >
          </button>
        </div>
        <div v-if="active.status === 'feedback'" role="status" aria-live="polite">
          <p v-if="hall && hall.lastAward > 0" class="gain" data-testid="knowledge-gain">
            {{ t('knowledge.gain', { will: hall.lastAward }) }}
            <span v-if="hall.lastAward > 1">· {{ t('knowledge.fastBonus') }}</span>
          </p>
          <p v-else-if="selectedAnswer === question.answer">{{ t('knowledge.correct') }}</p>
          <p v-else>{{ t('knowledge.wrong') }}</p>
        </div>
      </template>
    </template>
    <p v-if="rejected" role="alert">{{ t('knowledge.rejected') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { knowledgePanelMode as mode, closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import KnowledgeWillMeter from './knowledge-will-meter.vue';
import KnowledgeHelp from './knowledge-help.vue';
import EyeIcon from '@/components/gui/icons/eye-icon.vue';
import { useKnowledgeChallenge } from '@/composables/use-knowledge-challenge';
import type { MathQuestion } from '@hexoflat/engine/knowledge/math';

const { t } = useI18n();
const { hero, busy, rejected, active, hall, question, selectedAnswer, send } =
  useKnowledgeChallenge();
const panel = ref<HTMLElement | null>(null);
const bookImage = '/hex-assets/hex-constructs/open-book-table-token-image.png';
const full = computed(() => !!hero.knowledge && hero.knowledge.current >= hero.knowledge.capacity);
const shownAt = ref(Date.now());
const expression = (q: MathQuestion) =>
  `${q.lhs} ${q.operation === 'multiply' ? '×' : '÷'} ${q.rhs}`;
function start() {
  void send({ kind: 'start', mode: 'hall', seed: crypto.randomUUID() });
}
const FEEDBACK_PAUSE_MS = { correct: 700, wrong: 2400 };
let nextTimer: number | null = null;
function clearNextTimer() {
  if (nextTimer !== null) window.clearTimeout(nextTimer);
  nextTimer = null;
}
function scheduleNext(sessionId: string, questionId: string, delay: number) {
  nextTimer = window.setTimeout(() => {
    nextTimer = null;
    const current = active.value;
    if (current?.id !== sessionId || current.status !== 'feedback') return;
    if (busy.value) return scheduleNext(sessionId, questionId, 100);
    void send({ kind: 'next', sessionId, questionId });
  }, delay);
}
watch(
  () => [active.value?.id, active.value?.index, active.value?.status],
  () => {
    clearNextTimer();
    const current = active.value;
    const asked = question.value;
    if (current?.status !== 'feedback' || !asked) return;
    const wasCorrect = selectedAnswer.value === asked.answer;
    scheduleNext(
      current.id,
      asked.id,
      wasCorrect ? FEEDBACK_PAUSE_MS.correct : FEEDBACK_PAUSE_MS.wrong,
    );
  },
  { immediate: true },
);
onBeforeUnmount(clearNextTimer);
watch(
  () => [active.value?.id, active.value?.index, active.value?.status],
  () => {
    if (active.value?.status === 'question') shownAt.value = Date.now();
  },
  { immediate: true },
);
watch(
  () => [mode.value, active.value?.index, active.value?.status],
  async () => {
    await nextTick();
    panel.value?.focus();
  },
  { immediate: true },
);
</script>

<style scoped src="./knowledge-board.css"></style>
