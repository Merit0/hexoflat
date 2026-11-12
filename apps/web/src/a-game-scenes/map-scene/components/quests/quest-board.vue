<template>
  <section
    class="quest-board"
    tabindex="-1"
    data-testid="quest-board"
    :aria-label="t('quest.boardTitle')"
    @keydown.esc="onEscape"
  >
    <knowledge-help
      testid="quest-board-help"
      :title="t('quest.board.help.title')"
      :label="t('quest.board.help.title')"
      :text="t('quest.board.help.text', { first: extra[0] ?? 0, second: extra[1] ?? 0 })"
    />
    <header class="top">
      <h2>
        <span>{{ t('quest.boardTitle') }}</span>
      </h2>
      <board-close-button
        testid="quest-board-close"
        :label="t('quest.close')"
        @close="closeKnowledgePanel()"
      />
    </header>
    <quest-run-panel v-if="run || result" />
    <template v-else>
      <div class="pill" data-testid="quest-board-resources">
        <span class="part" data-testid="quest-slots">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="#c9a04e"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <path d="M9 4V3h6v1M9 13l2 2 4-4" />
          </svg>
          <small>{{ t('quest.board.pill.taken') }}</small>
          <b>{{ slots.used }} / {{ slots.max }}</b>
        </span>
        <span class="sep" aria-hidden="true"></span>
        <quest-tip :text="t('quest.board.coins')">
          <span class="part gold" data-testid="quest-board-coins">
            <i class="coin" aria-hidden="true"></i><b>{{ coins }}</b>
          </span>
        </quest-tip>
        <span class="sep" aria-hidden="true"></span>
        <quest-tip :text="t('quest.board.will')">
          <span class="part" data-testid="quest-board-will">
            <i class="gem" aria-hidden="true"></i>
            <b><will-number :current="will.value" /></b>
            <small>/ {{ will.cap }}</small>
          </span>
        </quest-tip>
      </div>
      <quest-filter-chips />
      <div class="groups" @scroll.passive="details.close()">
        <section class="group" data-testid="quest-group-active">
          <h3>
            <span>{{ t('quest.board.group.active') }}</span>
            <i class="rule" aria-hidden="true"></i>
            <span class="count">{{
              t('quest.board.group.of', { used: slots.used, max: slots.max })
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
            <i class="rule" aria-hidden="true"></i>
            <span class="count">{{ t('quest.board.group.count', { n: available.length }) }}</span>
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
            <i class="rule" aria-hidden="true"></i>
            <span class="count">{{ t('quest.board.group.count', { n: locked.length }) }}</span>
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
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/700.css';
import { computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useQuestBoardView } from '@/composables/use-quest-board-view';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import WillNumber from '@/components/gui/will-number.vue';
import QuestRow from './quest-row.vue';
import QuestRunPanel from './quest-run-panel.vue';
import KnowledgeHelp from '../knowledge-help.vue';
import BoardCloseButton from '@/components/gui/board/board-close-button.vue';
import QuestFilterChips from './quest-filter-chips.vue';
import QuestTip from './quest-tip.vue';
import QuestDetailsPopover from './quest-details-popover.vue';

const { t } = useI18n();
const { active, available, locked, lockedCount, lockedOpen, rowById, will, coins, slots } =
  useQuestBoardView();
const details = useQuestDetails();
const extra = QUEST_SLOTS.extraCost;
const { run, result } = useQuestRunView();
const { message: startMessage } = useQuestRunActions();
const { message, status } = useQuestActions();

const openRow = computed(() => (details.openId.value ? rowById(details.openId.value) : null));
const anchor = details.anchor;

function onEscape() {
  if (details.pinned.value) details.closeAndFocusRow();
}

onBeforeUnmount(() => {
  details.close();
});
</script>

<style scoped>
.quest-board {
  --q-line: #3a4046;
  --q-text: #efe3c8;
  --q-body-text: #e6dbc4;
  --q-muted: #cfc6b5;
  --q-label: #a9a39a;
  --q-display: 'Cormorant Garamond', Georgia, serif;
  --q-body: 'Alegreya Sans', system-ui, sans-serif;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-top: 8px;
  padding: 16px 16px 12px;
  overflow: hidden;
  font-family: var(--q-body);
  color: var(--q-text);
  background: linear-gradient(180deg, #17191c, #121416);
  border: 1px solid var(--q-line);
  border-radius: 12px;
}
.top {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  height: 50px;
}
h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-family: var(--q-display);
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
  color: #e9c77b;
  text-shadow: 0 1px 0 #6b4f1c;
}
h2::before,
h2::after {
  flex: 1;
  max-width: 90px;
  height: 1px;
  content: '';
}
h2::before {
  margin-left: auto;
  background: linear-gradient(90deg, transparent, #b8913f);
}
h2::after {
  margin-right: auto;
  background: linear-gradient(90deg, #b8913f, transparent);
}
.pill {
  display: flex;
  align-items: center;
  align-self: center;
  gap: 14px;
  height: 40px;
  padding: 0 18px;
  background: #15181b;
  border: 1px solid var(--q-line);
  border-radius: 20px;
}
.part {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--q-muted);
}
.part b {
  font-family: var(--q-display);
  font-size: 20px;
  color: var(--q-text);
}
.part.gold b {
  color: #e9c77b;
}
.part small {
  font-size: 13px;
  color: var(--q-label);
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--q-line);
}
.coin {
  width: 12px;
  height: 12px;
  background: #7a5a1e;
  border: 2px solid #f0c060;
  border-radius: 50%;
  box-sizing: border-box;
}
.gem {
  width: 10px;
  height: 10px;
  background: #5b3fe0;
  border: 1px solid #b89bff;
  transform: rotate(45deg);
}
.groups {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 2px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.group h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #b7ae9e;
}
.rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #4a4232, transparent);
}
.count {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--q-label);
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
  font-size: 15px;
  text-align: center;
  color: var(--q-label);
}
.dashed {
  border: 1px dashed #4a5057;
  border-radius: 10px;
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
  outline: 2px solid #c9a04e;
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
  color: #f2b3a2;
  background: #2e1f1b;
  border: 1px solid #5a3328;
  border-radius: 8px;
}
.status {
  position: relative;
  margin: 0;
  padding-top: 10px;
  font-size: 14px;
  text-align: center;
  color: var(--q-label);
}
.status::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, #6b5a33, transparent);
}
</style>
