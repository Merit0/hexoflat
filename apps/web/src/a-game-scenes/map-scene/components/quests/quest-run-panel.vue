<template>
  <div class="run" data-testid="quest-run-panel">
    <article v-if="run" class="card" data-testid="quest-run-card" :data-phase="run.phase">
      <h3>{{ t(run.nameKey) }}</h3>
      <p class="step" data-testid="quest-run-step">
        {{ t('quest.run.step', { n: run.step, total: run.steps }) }}
      </p>
      <p class="chips">
        <span>{{ t('quest.chip.stepPrice', { n: run.stepCost }) }}</span>
        <span>{{ t('quest.chip.backPrice', { n: run.backCost }) }}</span>
      </p>
      <p class="trail" data-testid="quest-trail-row">
        {{ t('quest.run.trail') }}: {{ run.trail.length ? run.trail.join(' · ') : '—' }}
      </p>
      <p v-if="run.phase === 'collect'" class="note">{{ t('quest.run.collect') }}</p>
      <p v-else-if="run.phase === 'ambush'" class="note">{{ t('quest.run.ambush') }}</p>
      <p v-else-if="run.projection.chest" class="note">{{ t('quest.run.chestSeen') }}</p>
      <div class="buttons">
        <button
          v-if="run.phase === 'collect'"
          type="button"
          class="primary"
          data-testid="quest-return-to-camp"
          :disabled="busy"
          @click="giveReturn"
        >
          {{ t('quest.run.return') }}
        </button>
        <template v-if="run.canGiveUp">
          <button
            v-if="!confirming"
            type="button"
            data-testid="quest-give-up"
            :disabled="busy"
            @click="confirming = true"
          >
            {{ t('quest.run.giveUp') }}
          </button>
          <template v-else>
            <button
              type="button"
              data-testid="quest-give-up-confirm"
              :disabled="busy"
              @click="leave"
            >
              {{ t('quest.run.giveUpConfirm') }}
            </button>
            <button type="button" data-testid="quest-give-up-cancel" @click="confirming = false">
              {{ t('quest.run.giveUpCancel') }}
            </button>
          </template>
        </template>
      </div>
    </article>
    <article
      v-else-if="result"
      class="card result"
      data-testid="quest-result"
      :data-outcome="result.outcome"
    >
      <h3>{{ t(result.nameKey) }}</h3>
      <p class="outcome">{{ t(`quest.result.${result.outcome}`) }}</p>
      <p class="trail">
        {{ t('quest.run.trail') }}: {{ result.numbers.length ? result.numbers.join(' · ') : '—' }}
      </p>
      <p v-if="result.firstDeviation" class="note" data-testid="quest-result-review">
        {{
          t('quest.result.review', {
            took: result.firstDeviation.number,
            rule: result.firstDeviation.expected,
          })
        }}
      </p>
      <div class="buttons">
        <button type="button" data-testid="quest-result-dismiss" @click="dismissQuestResult()">
          {{ t('quest.result.dismiss') }}
        </button>
      </div>
    </article>
    <p v-if="message" role="alert" class="message" data-testid="quest-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import { dismissQuestResult } from '@/services/quests/quest-result';

const { t } = useI18n();
const { run, result } = useQuestRunView();
const { message, busy, giveUp, returnToCamp } = useQuestRunActions();
const confirming = ref(false);

async function leave() {
  confirming.value = false;
  await giveUp();
}
async function giveReturn() {
  await returnToCamp();
}
</script>

<style scoped>
.run {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #f1e4cc;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #3a4a58;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
}
h3,
p {
  margin: 0;
}
h3 {
  color: #ffe98a;
}
.step {
  font-size: 1.1rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.85rem;
}
.chips span {
  padding: 2px 8px;
  border: 1px solid #3a4a58;
  border-radius: 999px;
}
.trail,
.note,
.outcome {
  font-size: 0.9rem;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
button {
  padding: 0.3rem 0.8rem;
}
.primary {
  color: #1b1714;
  background: #ffe98a;
}
.message {
  color: #ff9d8a;
  font-size: 0.85rem;
}
</style>
