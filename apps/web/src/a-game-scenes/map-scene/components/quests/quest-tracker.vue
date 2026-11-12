<template>
  <section class="tracker" data-testid="quest-tracker" :aria-label="t('quest.myQuests')">
    <h3>{{ t('quest.myQuests') }}</h3>
    <p v-if="tracked.length === 0" class="empty" data-testid="quest-tracker-empty">
      {{ t('quest.noneActive') }}
    </p>
    <ul v-else>
      <li
        v-for="entry in tracked"
        :key="entry.quest.id"
        :class="{ 'is-ready': entry.ready }"
        :data-testid="`quest-tracked-${entry.quest.id}`"
        :data-ready="entry.ready"
      >
        <div class="row">
          <strong>{{ t(entry.quest.nameKey) }}</strong>
          <span v-if="entry.ready" class="mark" aria-hidden="true">★</span>
          <span class="count" :data-testid="`quest-progress-${entry.quest.id}`">
            {{ entry.progress }} / {{ entry.target }}
          </span>
        </div>
        <div class="bar" aria-hidden="true">
          <i :style="{ width: `${Math.min(100, (entry.progress / entry.target) * 100)}%` }"></i>
        </div>
        <p class="reward">{{ entry.quest.rewards.map(rewardText).join(', ') }}</p>
        <div class="buttons">
          <button
            v-if="entry.ready"
            type="button"
            class="claim"
            :data-testid="`quest-claim-${entry.quest.id}`"
            :disabled="busy"
            @click="claim(entry.quest.id)"
          >
            {{ t('quest.claim') }}
          </button>
          <button
            type="button"
            class="drop"
            :data-testid="`quest-abandon-${entry.quest.id}`"
            :disabled="busy"
            @click="abandon(entry.quest.id)"
          >
            {{ t('quest.abandon') }}
          </button>
        </div>
      </li>
    </ul>
    <p v-if="message" role="alert" class="message" data-testid="quest-message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useQuestView } from '@/composables/use-quest-view';
import { useQuestActions } from '@/composables/use-quest-actions';
import { rewardText } from './quest-reward-text';

const { t } = useI18n();
const { tracked } = useQuestView();
const { message, busy, claim, abandon } = useQuestActions();
</script>

<style scoped>
.tracker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #f1e4cc;
}
h3 {
  margin: 0;
  font-size: 1rem;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  color: #ffe98a;
}
ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  padding: 8px 10px;
  border: 1px solid #3a4a58;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
}
li.is-ready {
  border-color: #ffe98a;
  box-shadow: 0 0 10px rgba(255, 233, 138, 0.35);
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.count {
  margin-left: auto;
}
.mark {
  color: #ffe98a;
}
.bar {
  height: 6px;
  margin: 6px 0;
  border-radius: 3px;
  background: #1b1714;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: #f5a524;
}
.reward,
.empty,
.message {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.85;
}
.message {
  color: #ff9d8a;
  opacity: 1;
}
.buttons {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
button {
  padding: 0.3rem 0.8rem;
}
.claim {
  color: #1b1714;
  background: #ffe98a;
}
</style>
