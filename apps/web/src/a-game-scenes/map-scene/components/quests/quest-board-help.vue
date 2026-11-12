<template>
  <div class="help">
    <button
      type="button"
      class="help-btn"
      data-testid="quest-board-help"
      :aria-label="t('quest.board.help.title')"
      :aria-expanded="details.helpOpen.value"
      @mouseenter="details.hoverHelp(true)"
      @mouseleave="details.hoverHelp(false)"
      @focus="details.hoverHelp(true)"
      @blur="details.hoverHelp(false)"
      @click="details.toggleHelp()"
    >
      ?
    </button>
    <section
      v-if="details.helpOpen.value"
      class="popover"
      role="note"
      data-testid="quest-board-help-popover"
    >
      <h3>{{ t('quest.board.help.title') }}</h3>
      <ul>
        <li>{{ t('quest.board.help.take') }}</li>
        <li>{{ t('quest.board.help.slots', { first: extra[0] ?? 0, second: extra[1] ?? 0 }) }}</li>
        <li>{{ t('quest.board.help.claim') }}</li>
        <li>{{ t('quest.board.help.expedition') }}</li>
        <li>{{ t('quest.board.help.abandon') }}</li>
        <li class="dim">{{ t('quest.board.hint') }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { useQuestDetails } from '@/composables/use-quest-details';

const { t } = useI18n();
const details = useQuestDetails();
const extra = QUEST_SLOTS.extraCost;
</script>

<style scoped>
.help-btn {
  width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  font-family: 'Cinzel', serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--q-gold-text);
  background: var(--q-raised);
  border: 1px solid var(--q-line);
  border-radius: 10px;
  cursor: pointer;
}
.help-btn:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: 2px;
}
.popover {
  position: absolute;
  top: 56px;
  right: 16px;
  left: 16px;
  z-index: 5;
  padding: 14px 16px;
  color: var(--q-text);
  background: var(--q-raised);
  border: 1px solid #6b5a33;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}
h3 {
  margin: 0 0 8px;
  font-family: 'Cinzel', serif;
  font-size: 16px;
  color: var(--q-gold-text);
}
ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.35;
}
.dim {
  color: var(--q-label);
  list-style: none;
  margin-left: -18px;
}
</style>
