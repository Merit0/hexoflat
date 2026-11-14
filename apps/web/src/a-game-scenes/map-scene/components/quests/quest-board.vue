<template>
  <section
    class="quest-board"
    tabindex="-1"
    data-testid="quest-board"
    :aria-label="t('quest.boardTitle')"
    @keydown.esc="onEscape"
  >
    <board-header
      class="header"
      :title="t('quest.boardTitle')"
      :help-title="t('quest.board.help.title')"
      :help-text="t('quest.board.help.text', { first: extra[0] ?? 0, second: extra[1] ?? 0 })"
      help-testid="quest-board-help"
      close-testid="quest-board-close"
      :close-label="t('quest.close')"
      @close="closeKnowledgePanel()"
    />
    <quest-run-panel v-if="run || result" />
    <template v-else>
      <div class="banner" data-testid="quest-board-resources">
        <quest-tip :text="t('quest.board.coins')">
          <span class="cell" data-testid="quest-board-coins">
            <img class="icon" :src="COIN_SRC" alt="" aria-hidden="true" />
            <span class="figures">
              <span class="label">{{ t('quest.board.coins') }}</span>
              <span class="value">{{ coins }}</span>
            </span>
          </span>
        </quest-tip>
        <i class="divider" aria-hidden="true"></i>
        <quest-tip :text="t('quest.board.will')">
          <span class="cell" data-testid="quest-board-will">
            <img class="icon" :src="WILL_ICON_URL" alt="" aria-hidden="true" />
            <span class="figures">
              <span class="label">{{ t('quest.board.will') }}</span>
              <span class="value"><will-number :current="will.value" /> / {{ will.cap }}</span>
            </span>
          </span>
        </quest-tip>
      </div>
      <board-ornament />
      <quest-taken-bar />
      <div class="groups" @scroll.passive="details.close()">
        <section
          class="group"
          :class="dropClass('active')"
          data-quest-group="active"
          data-testid="quest-group-active"
        >
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
        </section>
        <section
          class="group"
          :class="dropClass('available')"
          data-quest-group="available"
          data-testid="quest-group-available"
        >
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
      </div>
      <p v-if="startMessage" role="alert" class="alert" data-testid="quest-start-message">
        {{ startMessage }}
      </p>
      <p v-if="message" role="alert" class="alert" data-testid="quest-message">{{ message }}</p>
      <p class="status" role="status" aria-live="polite" data-testid="quest-board-status">
        {{ status ?? t('quest.board.hint') }}
      </p>
    </template>
    <quest-drag-ghost />
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
import { getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useQuestBoardView } from '@/composables/use-quest-board-view';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import { questDrag, targetOf } from '@/composables/use-quest-drag';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import WillNumber from '@/components/gui/will-number.vue';
import QuestRow from './quest-row.vue';
import QuestRunPanel from './quest-run-panel.vue';
import BoardHeader from '../board-header.vue';
import BoardOrnament from '../board-ornament.vue';
import QuestTakenBar from './quest-taken-bar.vue';
import QuestTip from './quest-tip.vue';
import QuestDragGhost from './quest-drag-ghost.vue';
import QuestDetailsPopover from './quest-details-popover.vue';

const { t } = useI18n();
const { active, available, rowById, will, coins, slots } = useQuestBoardView();
const details = useQuestDetails();
const extra = QUEST_SLOTS.extraCost;
const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';
const { run, result } = useQuestRunView();
const { message: startMessage } = useQuestRunActions();
const { message, status } = useQuestActions();

function dropClass(group: 'active' | 'available') {
  if (!questDrag.active || !questDrag.from) return {};
  const valid = targetOf(questDrag.from) === group;
  return { 'is-drop-target': valid, 'is-drop-over': valid && questDrag.over === group };
}

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
  flex: 1 1 0;
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
.header {
  margin: -16px -16px 0;
}
.banner {
  --diamond: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 0L10 5L5 10L0 5Z' fill='%23b8864a'/></svg>");
  position: relative;
  isolation: isolate;
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 11px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 68px;
  padding: 4px 12px;
  color: #f1e4cc;
  background: linear-gradient(180deg, #5a6d7e, #202b36);
  clip-path: polygon(
    12px 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    12px 100%,
    0 calc(100% - 12px),
    0 12px
  );
}
.banner::before {
  position: absolute;
  inset: 2px;
  z-index: -1;
  content: '';
  background: linear-gradient(180deg, #1a2029, #10151c);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px),
    0 10px
  );
}
.banner :deep(.tip-host) {
  display: flex;
  align-self: stretch;
  justify-content: center;
  min-width: 0;
}
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  gap: 8px;
  min-width: 0;
}
.icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.6));
}
.figures {
  display: grid;
  gap: 2px;
  white-space: nowrap;
}
.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(243, 232, 210, 0.82);
}
.value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f3e8d2;
  font-variant-numeric: tabular-nums;
}
.divider {
  align-self: stretch;
  background:
    var(--diamond) center / 11px 11px no-repeat,
    linear-gradient(180deg, transparent, #b8864a 20%, #b8864a 80%, transparent) center / 1px 100%
      no-repeat;
}
.groups {
  zoom: 1.2;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 2px;
  overflow: hidden;
}
.group {
  border-radius: 10px;
  transition:
    outline-color 0.15s,
    background 0.15s;
  outline: 2px dashed transparent;
  outline-offset: 2px;
}
.group.is-drop-target {
  outline-color: rgba(217, 168, 78, 0.55);
}
.group.is-drop-over {
  background: rgba(217, 168, 78, 0.1);
  outline-color: #ffe98a;
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
