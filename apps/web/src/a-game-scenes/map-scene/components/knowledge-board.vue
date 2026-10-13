<template>
  <section
    ref="panel"
    class="knowledge-board"
    tabindex="-1"
    data-testid="knowledge-board"
    :aria-label="mode === 'hall' ? t('knowledge.title') : t('knowledge.returnTitle')"
  >
    <header>
      <h2>{{ mode === 'hall' ? t('knowledge.title') : t('knowledge.returnTitle') }}</h2>
      <button type="button" :aria-label="t('knowledge.close')" @click="closeKnowledgePanel()">
        ×
      </button>
    </header>
    <p v-if="hero.knowledgeError" role="alert">{{ t('knowledge.saveError') }}</p>
    <template v-if="hero.knowledge">
      <p data-testid="knowledge-will">{{ t('knowledge.will', hero.knowledge) }}</p>
      <progress
        :value="hero.knowledge.current"
        :max="hero.knowledge.capacity"
        :aria-label="t('knowledge.will', hero.knowledge)"
      />
      <template v-if="!active">
        <img class="hero-emblem" :src="heroImage" :alt="hero.hero.name" />
        <h3>{{ t('knowledge.mixed') }}</h3>
        <p>
          {{ t('knowledge.mastery') }}:
          {{
            masteryLevel === null
              ? '—'
              : `${'◆'.repeat(masteryLevel)}${'◇'.repeat(5 - masteryLevel)}`
          }}
        </p>
        <p>{{ t('knowledge.description') }}</p>
        <p v-if="mode === 'return'">{{ t('knowledge.target') }}</p>
        <button
          type="button"
          data-testid="knowledge-start"
          :disabled="busy || hero.knowledgeError || (mode === 'hall' && full)"
          aria-describedby="knowledge-entry-message"
          @click="start"
        >
          {{ t('knowledge.start') }}
        </button>
        <p id="knowledge-entry-message">
          {{ mode === 'hall' && full ? t('knowledge.full') : t('knowledge.noTimer') }}
        </p>
      </template>
      <template v-else-if="question && ['question', 'feedback'].includes(active.status)">
        <p v-if="hall" data-testid="knowledge-earned">
          {{ t('knowledge.progressOpen', { index: hall.index + 1 }) }} ·
          {{ t('knowledge.earned', { will: hall.earned }) }}
        </p>
        <template v-else-if="ret">
          <p>{{ t('knowledge.progress', { index: ret.index + 1 }) }}</p>
          <progress
            :value="ret.answers.length"
            :max="20"
            :aria-label="t('knowledge.progress', { index: ret.index + 1 })"
          />
        </template>
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
                elapsedMs: hall ? Date.now() - shownAt : undefined,
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
      <template v-else-if="ret && ret.status === 'result'">
        <h3 data-testid="knowledge-result">{{ correct }}/20 · {{ percent }}%</h3>
        <p>{{ gradeText }}</p>
        <template v-if="correct >= 17">
          <p>{{ t('knowledge.returnPassed') }}</p>
          <button
            type="button"
            data-testid="knowledge-return"
            :disabled="busy"
            @click="send({ kind: 'return', sessionId: ret.id, assisted: false })"
          >
            {{ t('knowledge.returnConfirm') }}
          </button>
        </template>
        <template v-else>
          <p>{{ t('knowledge.target') }}</p>
          <button type="button" :disabled="busy" @click="start">{{ t('knowledge.retry') }}</button>
          <h3>{{ t('knowledge.review') }}</h3>
          <p>{{ t('knowledge.assistanceRule') }}</p>
          <template v-if="review">
            <p>{{ ret.reviewIndex + 1 }}/10 · {{ expression(review) }} = {{ review.answer }}</p>
            <div class="answers">
              <button
                v-for="option in review.options"
                :key="option"
                type="button"
                :disabled="busy"
                @click="
                  send({
                    kind: 'review',
                    sessionId: ret.id,
                    index: ret.reviewIndex,
                    answer: option,
                  })
                "
              >
                {{ option }}
              </button>
            </div>
          </template>
          <button
            v-if="canAssist"
            type="button"
            :disabled="busy"
            @click="send({ kind: 'return', sessionId: ret.id, assisted: true })"
          >
            {{ t('knowledge.assisted') }}
          </button>
        </template>
        <ul v-if="missed.length">
          <li v-for="q in missed" :key="q.id">{{ expression(q) }} = {{ q.answer }}</li>
        </ul>
      </template>
    </template>
    <p v-if="rejected" role="alert">{{ t('knowledge.rejected') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { knowledgePanelMode as mode, closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useKnowledgeChallenge } from '@/composables/use-knowledge-challenge';
import { mastery } from '@hexoflat/engine/knowledge/math';
import type { MathQuestion } from '@hexoflat/engine/knowledge/math';

const { t } = useI18n();
const {
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
} = useKnowledgeChallenge();
const gradeText = computed(
  () =>
    ({
      'knowledge.grades.practice': t('knowledge.grades.practice'),
      'knowledge.grades.repeat': t('knowledge.grades.repeat'),
      'knowledge.grades.almost': t('knowledge.grades.almost'),
      'knowledge.grades.passed': t('knowledge.grades.passed'),
      'knowledge.grades.veryGood': t('knowledge.grades.veryGood'),
      'knowledge.grades.excellent': t('knowledge.grades.excellent'),
      'knowledge.grades.perfect': t('knowledge.grades.perfect'),
    })[gradeKey.value],
);
const panel = ref<HTMLElement | null>(null);
const heroImage = computed(() => `${import.meta.env.BASE_URL}hero-asssets/base-hero-hex.png`);
const masteryLevel = computed(() => {
  const levels = Object.values(hero.knowledge?.history ?? {})
    .map(mastery)
    .filter((value): value is number => value !== null);
  return levels.length
    ? Math.floor(levels.reduce((sum, level) => sum + level, 0) / levels.length)
    : null;
});
const full = computed(() => !!hero.knowledge && hero.knowledge.current >= hero.knowledge.capacity);
const missed = computed(
  () => ret.value?.questions.filter((q, i) => q.answer !== ret.value?.answers[i]).slice(0, 4) ?? [],
);
const shownAt = ref(Date.now());
const expression = (q: MathQuestion) =>
  `${q.lhs} ${q.operation === 'multiply' ? '×' : '÷'} ${q.rhs}`;
function start() {
  if (mode.value) void send({ kind: 'start', mode: mode.value, seed: crypto.randomUUID() });
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

<style scoped>
.knowledge-board {
  padding: 18px;
  overflow: auto;
  min-height: 0;
  color: #e6e6e6;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-size: 1.3rem;
}
.hero-emblem {
  width: 100px;
  height: 110px;
  object-fit: contain;
  align-self: center;
}
progress {
  width: 100%;
  accent-color: #bba7d2;
}
.question {
  font-size: 1.8rem;
  text-align: center;
  padding: 18px 0;
}
.answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
button {
  min-height: 44px;
  color: #eef0f5;
  background: #343043;
  border: 1px solid #797084;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.answers button {
  font-size: 1.5rem;
  font-weight: 800;
  min-height: 54px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.answers button:disabled {
  opacity: 0.85;
}
.answers button:disabled:not(.is-correct):not(.is-wrong) {
  opacity: 0.6;
}
.answers button.is-correct {
  background: #1f6b3a;
  border-color: #5be28a;
  box-shadow: 0 0 0 2px rgba(91, 226, 138, 0.35);
}
.answers button.is-wrong {
  background: #7a2530;
  border-color: #ff7a8a;
}
.gain {
  color: #7dffa8;
  font-weight: 800;
  font-size: 1.1rem;
}
.check {
  color: #5dff93;
  font-weight: 900;
  text-shadow: 0 0 6px rgba(93, 255, 147, 0.6);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible {
  outline: 3px solid #cbb9ee;
  outline-offset: 2px;
}
[role='status'] {
  display: grid;
  gap: 12px;
}
ul {
  padding-left: 20px;
}
</style>
