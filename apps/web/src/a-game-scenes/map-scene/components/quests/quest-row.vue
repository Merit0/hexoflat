<template>
  <li
    class="slot"
    :data-testid="row.taken ? `quest-tracked-${row.quest.id}` : undefined"
    :data-ready="row.taken ? String(row.ready) : undefined"
  >
    <div
      class="row"
      :class="[
        `is-${row.state}`,
        `cat-${row.category}`,
        { 'is-ready': row.ready, 'is-open-details': detailsOpen },
      ]"
      :data-testid="`quest-card-${row.quest.id}`"
      :data-state="row.state"
      :data-category="row.category"
    >
      <button
        ref="bodyEl"
        type="button"
        class="body"
        :data-testid="`quest-row-${row.quest.id}`"
        :aria-expanded="detailsOpen"
        :aria-label="t('quest.board.rowLabel', { name: t(row.quest.nameKey), meta: metaText })"
        @mouseenter="onHover"
        @mouseleave="details.leave()"
        @focus="onHover"
        @blur="details.leave()"
        @click="onToggle"
      >
        <span class="tile"><quest-category-icon :category="row.category" /></span>
        <span class="text">
          <span class="title-line">
            <span class="name">{{ t(row.quest.nameKey) }}</span>
            <span
              class="kind"
              :title="row.repeat === 'once' ? t('quest.once') : t('quest.repeatable')"
              >{{ row.repeat === 'once' ? '1×' : '⟳' }}</span
            >
          </span>
          <span
            v-if="row.seeker && row.state === 'open'"
            class="meta chips"
            :data-testid="`quest-chips-${row.quest.id}`"
          >
            <span>{{ t('quest.chip.entry', { n: row.seeker.entry }) }}</span>
            <span>{{ t('quest.chip.steps', { n: row.seeker.steps }) }}</span>
            <span>{{ t('quest.chip.stepPrice', { n: row.seeker.stepCost }) }}</span>
            <span>{{ t('quest.chip.backPrice', { n: row.seeker.backCost }) }}</span>
          </span>
          <span
            v-else
            class="meta"
            :class="{ 'is-gold': row.ready, 'is-danger': row.reason === 'will' && !row.seeker }"
            >{{ metaText }}</span
          >
          <span v-if="showBar" class="bar" aria-hidden="true"
            ><i :style="{ width: `${percent}%` }"></i
          ></span>
        </span>
        <span class="reward" :data-testid="`quest-reward-${row.quest.id}`">
          <template v-if="mainReward">
            <quest-reward-icon :reward="mainReward" />
            <b>{{ rewardValue }}</b>
            <em v-if="row.rewards.length > 1">+{{ row.rewards.length - 1 }}</em>
          </template>
        </span>
      </button>
      <div class="action">
        <span v-if="row.state === 'locked'" class="locked-mark">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {{ t('quest.locked') }}
        </span>
        <button
          v-else-if="row.ready"
          type="button"
          class="btn claim"
          :data-testid="`quest-claim-${row.quest.id}`"
          :disabled="busy"
          @click="actions.claim(row)"
        >
          {{ t('quest.claim') }}
        </button>
        <button
          v-else-if="row.taken && row.seeker"
          type="button"
          class="btn"
          :data-testid="`quest-start-${row.quest.id}`"
          :disabled="busy"
          @click="actions.enter(row)"
        >
          {{ t('quest.enter') }}
        </button>
        <span v-else-if="row.taken" class="counter" :data-testid="`quest-progress-${row.quest.id}`"
          >{{ row.progress }} / {{ row.target }}</span
        >
        <button
          v-else
          type="button"
          class="btn price"
          :data-testid="row.seeker ? `quest-start-${row.quest.id}` : `quest-accept-${row.quest.id}`"
          :disabled="busy || row.reason === 'will'"
          :title="reasonText ?? undefined"
          :aria-label="t('quest.board.takeFor', { name: t(row.quest.nameKey), n: row.price })"
          @click="actions.take(row)"
        >
          <i class="gem" aria-hidden="true"></i>{{ row.price }}
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { QuestRowView } from '@/composables/use-quest-board-view';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestRowActions } from '@/composables/use-quest-row-actions';
import QuestCategoryIcon from './quest-category-icon.vue';
import QuestRewardIcon from './quest-reward-icon.vue';

const props = defineProps<{ row: QuestRowView }>();
const { t } = useI18n();
const details = useQuestDetails();
const actions = useQuestRowActions();
const { busy } = actions;
const bodyEl = ref<HTMLButtonElement | null>(null);

const detailsOpen = computed(() => details.openId.value === props.row.quest.id);
const mainReward = computed(() => props.row.rewards[0] ?? null);
const showBar = computed(() => props.row.taken && !props.row.seeker);
const percent = computed(() =>
  Math.min(100, (props.row.progress / Math.max(1, props.row.target)) * 100),
);
const rewardValue = computed(() => {
  const reward = mainReward.value;
  if (!reward) return '';
  if (reward.kind === 'item' && reward.itemKey !== HEXOBJECT_KEYS.COINS) return `×${reward.amount}`;
  return String(reward.amount);
});

const reasonText = computed(() => {
  if (props.row.reason === 'will') return t('quest.board.reason.will');
  if (props.row.reason === 'slots') return t('quest.board.reason.slots');
  return null;
});

const metaText = computed(() => {
  const row = props.row;
  if (row.ready) return t('quest.board.meta.ready');
  if (row.state === 'locked') {
    return row.lockedByKey ? t('quest.lockedBy', { name: t(row.lockedByKey) }) : t('quest.locked');
  }
  if (row.taken) {
    return row.seeker
      ? t('quest.board.meta.onTrail')
      : t('quest.board.meta.progress', {
          done: row.progress,
          n: row.target,
          unit: t(row.unitKey),
        });
  }
  if (row.seeker) return '';
  if (row.reason === 'will') return t('quest.board.reason.will');
  return t('quest.board.meta.goal', { n: row.target, unit: t(row.unitKey) });
});

function onToggle() {
  if (bodyEl.value) details.toggle(props.row.quest.id, bodyEl.value);
}

function onHover() {
  if (bodyEl.value) details.hover(props.row.quest.id, bodyEl.value);
}
</script>

<style scoped>
.slot {
  list-style: none;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  align-items: center;
  height: 60px;
  padding-right: 10px;
  overflow: hidden;
  background: var(--q-row);
  border: 1px solid var(--q-line-soft);
  border-radius: 12px;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.row.is-taken {
  background: var(--q-row-active);
  border-color: var(--q-cat);
}
.row.is-ready {
  border-color: var(--q-gold);
}
.row.is-open-details {
  background: var(--q-raised);
  border-color: var(--q-gold-dim);
}
.row.is-locked .body {
  opacity: 0.62;
}
.cat-gather {
  --q-cat: #7fbf8a;
  --q-cat-bg: #1e2b22;
}
.cat-combat {
  --q-cat: #e08a74;
  --q-cat-bg: #2e1f1b;
}
.cat-learn {
  --q-cat: #8db4e8;
  --q-cat-bg: #1c2533;
}
.cat-exp {
  --q-cat: #e6b85c;
  --q-cat-bg: #2e2717;
}
.body {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 0;
  height: 100%;
  padding: 0 0 0 10px;
  color: var(--q-text);
  text-align: left;
  background: none;
  border: 0;
  border-radius: 12px 0 0 12px;
  cursor: pointer;
}
.body:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: -3px;
}
.tile {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--q-cat);
  background: var(--q-cat-bg);
  border-radius: 10px;
}
.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.kind {
  flex: none;
  font-size: 12px;
  color: var(--q-label);
}
.meta {
  overflow: hidden;
  font-size: 13px;
  color: var(--q-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.meta.is-gold {
  color: var(--q-gold);
}
.meta.is-danger {
  color: var(--q-danger-text);
}
.chips {
  display: flex;
  gap: 6px;
}
.chips span + span::before {
  margin-right: 6px;
  content: '·';
}
.bar {
  display: block;
  height: 4px;
  overflow: hidden;
  background: var(--q-bg);
  border-radius: 2px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--q-cat);
}
.row.is-ready .bar i {
  background: var(--q-gold);
}
.reward {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 13px;
  color: var(--q-muted);
}
.reward b {
  font-family: var(--q-display);
  font-size: 14px;
  color: var(--q-text);
}
.reward em {
  font-size: 11px;
  font-style: normal;
  color: var(--q-label);
}
.action {
  display: grid;
  place-items: center end;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 96px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  font-family: var(--q-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--q-text);
  background: var(--q-raised);
  border: 1px solid var(--q-line);
  border-radius: 10px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--q-gold-dim);
}
.btn:focus-visible {
  outline: 2px solid var(--q-gold);
  outline-offset: 2px;
}
.btn:disabled {
  color: var(--q-label);
  cursor: not-allowed;
  opacity: 0.6;
}
.btn.claim {
  color: #1b1408;
  background: var(--q-gold);
  border-color: var(--q-gold);
}
.gem {
  width: 10px;
  height: 10px;
  background: #5b3fe0;
  border: 1px solid #b89bff;
  border-radius: 2px;
  transform: rotate(45deg);
}
.counter {
  display: grid;
  place-items: center;
  width: 96px;
  height: 40px;
  font-family: var(--q-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--q-text);
  border: 1px solid var(--q-cat);
  border-radius: 10px;
}
.locked-mark {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--q-label);
}
</style>
