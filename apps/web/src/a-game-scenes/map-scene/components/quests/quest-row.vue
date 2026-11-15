<template>
  <li
    class="slot"
    :data-testid="row.taken ? `quest-tracked-${row.quest.id}` : undefined"
    :data-ready="row.taken ? String(row.ready) : undefined"
  >
    <div
      ref="rowEl"
      class="row"
      :class="[
        `is-${row.state}`,
        {
          'is-ready': row.ready,
          'is-open-details': detailsOpen,
          'is-draggable': draggable,
          'is-dragging': questDrag.questId === row.quest.id,
        },
      ]"
      :data-testid="`quest-card-${row.quest.id}`"
      :data-state="row.state"
      :data-category="row.category"
    >
      <div
        ref="bodyEl"
        class="body"
        :class="{ 'cursor-grab': draggable }"
        :data-testid="`quest-row-${row.quest.id}`"
        :aria-expanded="detailsOpen"
        :aria-label="t('quest.board.rowLabel', { name: t(row.quest.nameKey), meta: metaText })"
        @mouseenter="onHover"
        @mouseleave="details.leave()"
        @pointerdown="onPress"
      >
        <img
          class="sprite"
          draggable="false"
          :src="row.sprite"
          alt=""
          aria-hidden="true"
          :data-testid="`quest-sprite-${row.quest.id}`"
        />
        <span class="text">
          <span class="title-line">
            <span class="name">{{ t(row.quest.nameKey) }}</span>
            <svg
              v-if="row.repeat === 'repeatable'"
              class="repeat"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              role="img"
              :aria-label="t('quest.board.tag.repeatable')"
              :data-testid="`quest-repeat-${row.quest.id}`"
            >
              <path d="M20 11a8 8 0 0 0-14.500-3.500M4 4v4h4" />
              <path d="M4 13a8 8 0 0 0 14.500 3.500M20 20v-4h-4" />
            </svg>
          </span>
          <span
            class="meta"
            :class="{
              'is-gold': row.ready,
              'is-goal': isGoalText,
              'is-danger': row.reason === 'will' && !row.seeker,
            }"
            >{{ metaText }}</span
          >
          <span v-if="showBar" class="bar" aria-hidden="true"
            ><i :class="{ 'is-full': row.ready }" :style="{ width: `${percent}%` }"></i
          ></span>
        </span>
      </div>
      <div
        class="reward"
        :class="{ 'cursor-grab': draggable }"
        :data-testid="`quest-reward-${row.quest.id}`"
        @mouseenter="onHover"
        @mouseleave="details.leave()"
        @pointerdown="onPress"
      >
        <template v-if="mainReward">
          <span class="reward-main">
            <quest-reward-icon :reward="mainReward" :size="20" />
            <b v-if="rewardValue">{{ rewardValue }}</b>
          </span>
          <em v-if="row.rewards.length > 1">{{
            t('quest.board.more', { n: row.rewards.length - 1 })
          }}</em>
        </template>
      </div>
      <div class="action">
        <quest-action-button
          v-if="row.ready"
          compact
          variant="claim"
          :testid="`quest-claim-${row.quest.id}`"
          :disabled="busy"
          @click="actions.claim(row)"
        >
          {{ t('quest.claim') }}
        </quest-action-button>
        <span v-else-if="row.taken && row.seeker" class="meta">{{ t('quest.findInSilesia') }}</span>
        <quest-action-button
          v-else-if="row.taken"
          compact
          variant="counter"
          interactive
          :testid="`quest-progress-${row.quest.id}`"
          :disabled="busy"
          :aria-label="t('quest.board.returnLabel', { name: t(row.quest.nameKey) })"
          @mouseenter="returnHover = true"
          @mouseleave="returnHover = false"
          @focus="returnHover = true"
          @blur="returnHover = false"
          @click="onReturn"
        >
          {{ returnHover ? t('quest.board.return') : `${row.progress} / ${row.target}` }}
        </quest-action-button>
        <quest-tip v-else :text="reasonText">
          <quest-action-button
            compact
            :testid="row.seeker ? `quest-start-${row.quest.id}` : `quest-accept-${row.quest.id}`"
            :disabled="busy || row.reason === 'will'"
            :aria-label="t('quest.board.takeFor', { name: t(row.quest.nameKey), n: row.price })"
            @click="actions.take(row)"
          >
            <img class="will-icon" :src="WILL_ICON_URL" alt="" aria-hidden="true" /><span
              class="price"
              :class="{ 'is-short': row.willShort }"
              :data-testid="`quest-price-${row.quest.id}`"
              >{{ row.price }}</span
            >
          </quest-action-button>
        </quest-tip>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { QuestRowView } from '@/composables/use-quest-board-view';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import { useQuestDetails } from '@/composables/use-quest-details';
import { beginQuestPress, questDrag } from '@/composables/use-quest-drag';
import { useQuestRowActions } from '@/composables/use-quest-row-actions';
import QuestActionButton from './quest-action-button.vue';
import QuestTip from './quest-tip.vue';
import QuestRewardIcon from './quest-reward-icon.vue';
import { isSingleItem } from './quest-reward-text';

const props = defineProps<{ row: QuestRowView }>();
const { t } = useI18n();
const details = useQuestDetails();
const actions = useQuestRowActions();
const { busy } = actions;
const bodyEl = ref<HTMLElement | null>(null);
const rowEl = ref<HTMLElement | null>(null);
const returnHover = ref(false);

const detailsOpen = computed(() => details.openId.value === props.row.quest.id);
const mainReward = computed(() => props.row.rewards[0] ?? null);
const showBar = computed(() => props.row.taken && !props.row.seeker);
const percent = computed(() =>
  Math.min(100, (props.row.progress / Math.max(1, props.row.target)) * 100),
);
const rewardValue = computed(() => {
  const reward = mainReward.value;
  if (!reward) return '';
  if (isSingleItem(reward)) return '';
  if (reward.kind === 'item' && reward.itemKey !== HEXOBJECT_KEYS.COINS) return `×${reward.amount}`;
  return String(reward.amount);
});

const isGoalText = computed(
  () => props.row.state === 'open' && (!!props.row.seeker || props.row.reason !== 'will'),
);

const reasonText = computed(() => {
  if (props.row.reason === 'will') return t('quest.board.reason.will');
  if (props.row.reason === 'slots') return t('quest.board.reason.slots');
  return null;
});

const metaText = computed(() => {
  const row = props.row;
  if (row.ready) return t('quest.board.meta.ready');
  if (row.taken) {
    return row.seeker
      ? t('quest.board.meta.onTrail')
      : t('quest.board.meta.progress', {
          done: row.progress,
          n: row.target,
          unit: t(row.unitKey),
        });
  }
  if (row.seeker) return t('quest.board.meta.countCost');
  if (row.reason === 'will') return t('quest.board.reason.will');
  return t('quest.board.meta.goal', { n: row.target, unit: t(row.unitKey) });
});

const draggable = computed(
  () =>
    !props.row.ready &&
    (props.row.taken || (props.row.state === 'open' && props.row.reason !== 'will')),
);

function onPress(event: PointerEvent) {
  if (!draggable.value || !rowEl.value) return;
  const row = props.row;
  details.close();
  beginQuestPress(event, {
    questId: row.quest.id,
    label: t(row.quest.nameKey),
    element: rowEl.value,
    from: row.taken ? 'active' : 'available',
    onDrop: (target) => {
      if (target === 'active') void actions.place(row);
      else void actions.abandon(row);
    },
  });
}

async function onReturn() {
  returnHover.value = false;
  await actions.abandon(props.row);
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
  grid-template-columns: minmax(0, 1fr) 58px 92px;
  align-items: center;
  height: 64px;
  padding-right: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #1e2226, #16191c);
  border: 1px solid #30353a;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.row.is-dragging {
  opacity: 0.35;
}
.row.is-draggable {
  user-select: none;
  -webkit-user-select: none;
}
.row.is-draggable .body {
  touch-action: none;
}
.row.is-taken {
  border-color: #6b5a33;
}
.row.is-ready,
.row.is-open-details {
  border-color: #c9a04e;
  box-shadow:
    0 0 0 1px rgba(201, 160, 78, 0.35),
    0 0 18px rgba(201, 160, 78, 0.18);
}
.body {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 0;
  height: 100%;
  padding: 0 12px 0 10px;
  color: var(--q-text);
  text-align: left;
  background: none;
  border: 0;
  border-radius: 10px 0 0 10px;
  cursor: pointer;
}
.body:focus-visible {
  outline: 2px solid #c9a04e;
  outline-offset: -3px;
}
.sprite {
  user-select: none;
  -webkit-user-drag: none;
  width: 52px;
  height: 52px;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
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
  gap: 8px;
  min-width: 0;
}
.name {
  overflow: hidden;
  font-family: var(--q-display);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.05;
  color: #f0e4c8;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.meta {
  overflow: hidden;
  font-size: 14px;
  color: var(--q-label);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.meta.is-goal {
  color: #8fcb9a;
}
.repeat {
  flex: none;
  color: var(--q-label);
}
.meta.is-gold {
  color: #f0c060;
}
.meta.is-danger {
  color: #f2b3a2;
}
.bar {
  display: block;
  height: 4px;
  overflow: hidden;
  background: #0e1012;
  border-radius: 2px;
}
.bar i {
  display: block;
  height: 100%;
  background: #c9a04e;
}
.bar i.is-full {
  background: #f0c060;
}
.reward {
  display: flex;
  box-sizing: border-box;
  cursor: pointer;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 34px;
  border-left: 1px solid #343a40;
}
.reward-main {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.reward b {
  font-family: var(--q-display);
  font-size: 19px;
  color: #efe3c8;
}
.reward em {
  font-size: 10px;
  font-style: normal;
  line-height: 1;
  color: var(--q-label);
}
.action {
  display: grid;
  box-sizing: border-box;
  height: 34px;
  padding-left: 10px;
  place-items: center;
  border-left: 1px solid #343a40;
}
.price {
  font-weight: 700;
  color: #ffe98a;
}
.price.is-short {
  color: #ff6b5e;
}
.will-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
</style>
