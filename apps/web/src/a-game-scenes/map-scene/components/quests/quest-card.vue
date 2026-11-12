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
    <p class="goal">{{ t('quest.goal') }}: {{ card.target }} {{ t(card.unitKey) }}</p>
    <p class="reward">
      {{ t('quest.reward.label') }}: {{ card.rewards.map(rewardText).join(', ') }}
    </p>
    <footer>
      <span class="price">
        {{ card.price > 0 ? t('quest.price.will', { n: card.price }) : t('quest.price.free') }}
      </span>
      <button
        v-if="card.state === 'open'"
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
  </article>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { QuestCardView } from '@/composables/use-quest-view';
import { useQuestActions } from '@/composables/use-quest-actions';
import { rewardText } from './quest-reward-text';

defineProps<{ card: QuestCardView }>();
const { t } = useI18n();
const { busy, accept } = useQuestActions();
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
</style>
