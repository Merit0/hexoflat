<template>
  <div class="task-backdrop" @pointerdown.stop @click.stop>
    <div
      class="task"
      role="dialog"
      :aria-label="t(`battle.task.title.${task.kind}`)"
      :style="{ '--tone': tone }"
      data-testid="battle-task"
    >
      <div class="task__head">
        <span class="task__title">{{ t(`battle.task.title.${task.kind}`) }}</span>
        <span class="task__seconds" data-testid="battle-task-timer">
          {{ t('battle.task.seconds', { seconds: (left / 1000).toFixed(1) }) }}
        </span>
      </div>
      <p class="task__text">{{ t(`battle.task.text.${task.kind}`) }}</p>
      <div class="task__line">
        <span :style="{ width: `${percent}%` }"></span>
      </div>
      <div class="task__question">{{ t('battle.task.question', { question: task.question }) }}</div>
      <div class="task__options">
        <button
          v-for="(option, index) in task.options"
          :key="index"
          class="task__option"
          type="button"
          :disabled="settled"
          :data-testid="`battle-task-option-${index}`"
          @click="pick(index)"
        >
          {{ option }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BattleTaskView } from '@/composables/battle-view';

const TICK_MS = 100;

const props = defineProps<{ task: BattleTaskView }>();
const emit = defineEmits<{ answer: [option: number]; timeout: [] }>();
const { t } = useI18n();

const now = ref(Date.now());
const settled = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const total = computed(() => Math.max(1, props.task.deadlineMs - props.task.issuedAtMs));
const left = computed(() => Math.max(0, props.task.deadlineMs - now.value));
const percent = computed(() => Math.round((left.value / total.value) * 100));
const tone = computed(() =>
  percent.value > 50 ? '#5bd18a' : percent.value > 25 ? '#e0a93f' : '#ee4b37',
);

function pick(index: number) {
  if (settled.value) return;
  settled.value = true;
  emit('answer', index);
}

function tick() {
  now.value = Date.now();
  if (left.value > 0 || settled.value) return;
  settled.value = true;
  emit('timeout');
}

watch(
  () => props.task.deadlineMs,
  () => {
    settled.value = false;
    now.value = Date.now();
  },
);

onMounted(() => {
  timer = setInterval(tick, TICK_MS);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.task-backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgb(6 7 8 / 55%);
}
.task {
  display: grid;
  gap: 12px;
  width: min(440px, calc(100% - 32px));
  padding: 18px 20px;
  border-radius: 16px;
  border: 2px solid var(--tone);
  background: #191d20;
  box-shadow: 0 0 28px color-mix(in srgb, var(--tone) 35%, transparent);
  color: #ede3d2;
}
.task__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: Cinzel, serif;
}
.task__title {
  text-transform: uppercase;
  color: #ffb4a6;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.task__seconds {
  color: var(--tone);
  font-weight: 700;
}
.task__text {
  margin: 0;
  color: #cbbfa6;
  font-family: 'Alegreya Sans', sans-serif;
}
.task__line {
  height: 10px;
  border-radius: 999px;
  background: #121517;
  overflow: hidden;
}
.task__line span {
  display: block;
  height: 100%;
  background: var(--tone);
  transition: width 0.1s linear;
}
.task__question {
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}
.task__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.task__option {
  min-height: 56px;
  border-radius: 12px;
  border: 1px solid #4a5862;
  background: #262e33;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 1.5rem;
  font-weight: 700;
}
.task__option:hover:not(:disabled) {
  border-color: #e0a93f;
}
</style>
