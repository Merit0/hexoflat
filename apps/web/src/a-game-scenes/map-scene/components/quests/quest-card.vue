<template>
  <article
    class="card"
    :class="`is-${card.state}`"
    :data-testid="`quest-card-${card.quest.id}`"
    :data-state="card.state"
  >
    <header>
      <h3>{{ t(card.quest.nameKey) }}</h3>
      <span class="tag">{{
        card.repeat === 'once' ? t('quest.once') : t('quest.repeatable')
      }}</span>
    </header>
    <p class="desc">{{ t(card.quest.descKey) }}</p>
    <template v-if="card.seeker">
      <p class="chips" :data-testid="`quest-chips-${card.quest.id}`">
        <span>{{ t('quest.chip.entry', { n: card.seeker.entry }) }}</span>
        <span>{{ t('quest.chip.steps', { n: card.seeker.steps }) }}</span>
        <span>{{ t('quest.chip.stepPrice', { n: card.seeker.stepCost }) }}</span>
        <span>{{ t('quest.chip.backPrice', { n: card.seeker.backCost }) }}</span>
      </p>
      <p v-if="card.state === 'locked' && card.lockedByKey" class="reward">
        {{ t('quest.lockedBy', { name: t(card.lockedByKey) }) }}
      </p>
    </template>
    <template v-else>
      <p class="goal">{{ t('quest.goal') }}: {{ card.target }} {{ t(card.unitKey) }}</p>
      <p class="reward">
        {{ t('quest.reward.label') }}: {{ card.rewards.map(rewardText).join(', ') }}
      </p>
    </template>
    <footer>
      <span v-if="!card.seeker" class="price">
        {{ card.price > 0 ? t('quest.price.will', { n: card.price }) : t('quest.price.free') }}
      </span>
      <button
        v-if="card.seeker && card.state !== 'locked'"
        type="button"
        :data-testid="`quest-start-${card.quest.id}`"
        :disabled="busy || (card.state === 'open' && card.willShort)"
        @click="start(card.quest.id)"
      >
        {{ card.state === 'taken' ? t('quest.enter') : t('quest.start') }}
      </button>
      <span v-else-if="card.seeker" class="state">{{ t('quest.locked') }}</span>
      <button
        v-else-if="card.state === 'open'"
        type="button"
        :data-testid="`quest-accept-${card.quest.id}`"
        :disabled="busy"
        @click="accept(card.quest.id)"
      >
        {{ t('quest.accept') }}
      </button>
      <span v-else-if="card.state === 'taken'" class="state">{{ t('quest.taken') }}</span>
      <span v-else class="state">{{ t('quest.locked') }}</span>
    </footer>
    <p
      v-if="card.seeker && card.state === 'open' && card.willShort"
      class="reward"
      :data-testid="`quest-short-${card.quest.id}`"
    >
      {{ t('quest.refusal.INSUFFICIENT_WILL') }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { QuestCardView } from '@/composables/use-quest-view';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import { rewardText } from './quest-reward-text';

defineProps<{ card: QuestCardView }>();
const { t } = useI18n();
const { busy, accept } = useQuestActions();
const { start } = useQuestRunActions();
</script>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid #3a4a58;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: #f1e4cc;
}
.card.is-taken,
.card.is-locked {
  opacity: 0.6;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3,
p {
  margin: 0;
}
h3 {
  font-size: 1rem;
  color: #ffe98a;
}
.tag,
.state {
  font-size: 0.75rem;
  opacity: 0.8;
}
.desc,
.goal,
.reward {
  font-size: 0.85rem;
}
button {
  padding: 0.3rem 0.8rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.8rem;
}
.chips span {
  padding: 2px 8px;
  border: 1px solid #3a4a58;
  border-radius: 999px;
}
</style>
