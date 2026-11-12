<template>
  <section
    class="quest-board"
    tabindex="-1"
    data-testid="quest-board"
    :aria-label="t('quest.boardTitle')"
    @keydown.esc="onEscape"
  >
    <header class="top">
      <quest-board-help />
      <h2>{{ t('quest.boardTitle') }}</h2>
      <button
        type="button"
        class="close"
        data-testid="quest-board-close"
        :aria-label="t('quest.close')"
        @click="closeKnowledgePanel()"
      >
        ×
      </button>
    </header>
    <quest-run-panel v-if="run || result" />
    <template v-else>
      <div class="plate" data-testid="quest-board-resources">
        <span class="plate-label">{{ t('quest.board.will') }}</span>
        <span class="figures">
          <span class="coins" data-testid="quest-board-coins" :title="t('quest.board.coins')">
            <i class="coin" aria-hidden="true"></i>{{ coins }}
          </span>
          <span class="will" data-testid="quest-board-will">
            <will-number :current="will.value" /> / {{ will.cap }}
          </span>
        </span>
        <span class="track" aria-hidden="true"><i :style="{ width: `${willPercent}%` }"></i></span>
      </div>
      <quest-filter-chips />
      <div class="groups" @scroll.passive="details.close()">
        <section class="group" data-testid="quest-group-active">
          <h3>
            <span>{{ t('quest.board.group.active') }}</span>
            <span class="count" data-testid="quest-slots">{{
              t('quest.board.group.slots', { used: slots.used, max: slots.max })
            }}</span>
          </h3>
          <ul v-if="active.length > 0">
            <quest-row v-for="row in active" :key="row.quest.id" :row="row" />
          </ul>
          <p v-else class="empty dashed" data-testid="quest-tracker-empty">
            {{ t('quest.board.empty.active') }}
          </p>
        </section>
        <section class="group" data-testid="quest-group-available">
          <h3>
            <span>{{ t('quest.board.group.available') }}</span>
            <span class="count">{{ available.length }}</span>
          </h3>
          <ul v-if="available.length > 0">
            <quest-row v-for="row in available" :key="row.quest.id" :row="row" />
          </ul>
          <p v-else class="empty">{{ t('quest.board.empty.available') }}</p>
        </section>
        <section v-if="lockedCount > 0" class="group" data-testid="quest-group-locked">
          <h3>
            <button
              type="button"
              class="fold"
              data-testid="quest-group-locked-toggle"
              :aria-expanded="lockedOpen"
              @click="lockedOpen = !lockedOpen"
            >
              <span class="chev" :class="{ 'is-open': lockedOpen }" aria-hidden="true">›</span>
              {{ t('quest.board.group.locked') }}
            </button>
            <span class="count">{{ locked.length }}</span>
          </h3>
          <ul v-if="lockedOpen && locked.length > 0">
            <quest-row v-for="row in locked" :key="row.quest.id" :row="row" />
          </ul>
        </section>
      </div>
      <p v-if="startMessage" role="alert" class="alert" data-testid="quest-start-message">
        {{ startMessage }}
      </p>
      <p v-if="message" role="alert" class="alert" data-testid="quest-message">{{ message }}</p>
      <p class="status" role="status" aria-live="polite" data-testid="quest-board-status">
        {{ status ?? t('quest.board.hint') }}
      </p>
    </template>
    <quest-details-popover
      v-if="openRow && anchor && !run && !result"
      :key="openRow.quest.id"
      :row="openRow"
      :anchor="anchor"
      :pinned="details.pinned.value"
    />
  </section>
</template>

<script setup lang="ts">
import '@fontsource/cinzel/700.css';
import { computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useQuestBoardView } from '@/composables/use-quest-board-view';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import WillNumber from '@/components/gui/will-number.vue';
import QuestRow from './quest-row.vue';
import QuestRunPanel from './quest-run-panel.vue';
import QuestBoardHelp from './quest-board-help.vue';
import QuestFilterChips from './quest-filter-chips.vue';
import QuestDetailsPopover from './quest-details-popover.vue';

const { t } = useI18n();
const { active, available, locked, lockedCount, lockedOpen, rowById, will, coins, slots } =
  useQuestBoardView();
const details = useQuestDetails();
const { run, result } = useQuestRunView();
const { message: startMessage } = useQuestRunActions();
const { message, status } = useQuestActions();

const openRow = computed(() => (details.openId.value ? rowById(details.openId.value) : null));
const anchor = details.anchor;
const willPercent = computed(() =>
  will.value.cap > 0 ? Math.min(100, (will.value.value / will.value.cap) * 100) : 0,
);

function onEscape() {
  if (details.helpOpen.value) details.closeHelp();
  if (details.pinned.value) details.closeAndFocusRow();
}

onBeforeUnmount(() => {
  details.close();
  details.closeHelp();
});
</script>

<style scoped>
.quest-board {
  --q-bg: #121517;
  --q-panel: #191d20;
  --q-row: #20262a;
  --q-row-active: #1f2629;
  --q-raised: #262e33;
  --q-line: #36424a;
  --q-line-soft: #2e373d;
  --q-gold: #f0c060;
  --q-gold-text: #e8d7a8;
  --q-gold-dim: #8a7340;
  --q-text: #ede3d2;
  --q-muted: #cbbfa6;
  --q-label: #a9a08f;
  --q-danger-bg: #2e1f1b;
  --q-danger-text: #f2b3a2;
  --q-display: 'Cinzel', Georgia, serif;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-top: 8px;
  padding: 16px 16px 12px;
  overflow: hidden;
  color: var(--q-text);
  background: var(--q-panel);
  border: 1px solid var(--q-line);
  border-radius: 12px;
}
.top {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  height: 40px;
}
h2 {
  margin: 0;
  font-family: var(--q-display);
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  color: var(--q-gold-text);
}
.close {
  width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  font-size: 24px;
  line-height: 1;
  color: var(--q-muted);
  background: var(--q-raised);
  border: 1px solid var(--q-line);
  border-radius: 10px;
  cursor: pointer;
}
.close:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: 2px;
}
.plate {
  display: grid;
  grid-template-columns: auto 1fr;
  row-gap: 8px;
  align-items: center;
  padding: 10px 14px;
  background: var(--q-row);
  border: 1px solid var(--q-line-soft);
  border-radius: 12px;
}
.plate-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--q-label);
}
.figures {
  display: flex;
  justify-content: flex-end;
  gap: 18px;
  font-family: var(--q-display);
  font-size: 16px;
  font-weight: 700;
}
.coins {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--q-gold);
}
.coin {
  width: 10px;
  height: 10px;
  background: var(--q-gold);
  border-radius: 50%;
}
.track {
  grid-column: 1 / -1;
  height: 6px;
  overflow: hidden;
  background: var(--q-bg);
  border-radius: 3px;
}
.track i {
  display: block;
  height: 100%;
  background: #9a6bff;
  transition: width 0.3s ease;
}
.groups {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}
.group h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--q-label);
}
.count {
  font-weight: 500;
  letter-spacing: 0.04em;
}
ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.empty {
  margin: 0;
  padding: 14px;
  font-size: 14px;
  text-align: center;
  color: var(--q-label);
}
.dashed {
  border: 1px dashed var(--q-line);
  border-radius: 12px;
}
.fold {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 0;
  padding: 0;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.fold:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: 2px;
}
.chev {
  display: inline-block;
  font-size: 16px;
  transition: transform 0.15s;
}
.chev.is-open {
  transform: rotate(90deg);
}
.alert {
  margin: 0;
  padding: 8px 10px;
  font-size: 14px;
  color: var(--q-danger-text);
  background: var(--q-danger-bg);
  border-radius: 8px;
}
.status {
  margin: 0;
  padding-top: 10px;
  font-size: 14px;
  text-align: center;
  color: var(--q-muted);
  border-top: 1px solid var(--q-line);
}
</style>
