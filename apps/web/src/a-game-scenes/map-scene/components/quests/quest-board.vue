<template>
  <section
    class="quest-board"
    tabindex="-1"
    data-testid="quest-board"
    :aria-label="t('quest.boardTitle')"
  >
    <header>
      <h2>{{ t('quest.boardTitle') }}</h2>
      <board-close-button
        testid="quest-board-close"
        :label="t('quest.close')"
        @close="closeKnowledgePanel()"
      />
    </header>
    <quest-run-panel v-if="run || result" />
    <template v-else>
      <p class="slots" data-testid="quest-slots">
        {{ t('quest.slots', { used: slotLine.used, max: slotLine.max }) }}
      </p>
      <div class="cards">
        <quest-card v-for="card in cards" :key="card.quest.id" :card="card" />
      </div>
      <p v-if="startMessage" role="alert" class="start-message" data-testid="quest-start-message">
        {{ startMessage }}
      </p>
      <hr />
      <quest-tracker />
      <p class="how">{{ t('quest.seekerHow') }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useQuestView } from '@/composables/use-quest-view';
import BoardCloseButton from '@/components/gui/board/board-close-button.vue';
import QuestCard from './quest-card.vue';
import QuestTracker from './quest-tracker.vue';
import QuestRunPanel from './quest-run-panel.vue';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';

const { t } = useI18n();
const { cards, slotLine } = useQuestView();
const { run, result } = useQuestRunView();
const { message: startMessage } = useQuestRunActions();
</script>

<style scoped>
.quest-board {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-top: 8px;
  padding: 20px;
  overflow: auto;
  scrollbar-width: none;
  color: #f1e4cc;
  background: linear-gradient(180deg, #1b1714, #0f0d0b);
  border: 2px solid #3a4a58;
  border-radius: 10px;
}
header {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50px;
}
h2 {
  margin: 0;
  font-size: 1.6rem;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  color: #ffe98a;
}
.slots {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.start-message {
  margin: 0;
  color: #ff9d8a;
  font-size: 0.85rem;
}
.how {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.75;
}
hr {
  width: 100%;
  border: 0;
  border-top: 1px solid #3a4a58;
}
</style>
