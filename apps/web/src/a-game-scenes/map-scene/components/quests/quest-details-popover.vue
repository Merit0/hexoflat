<template>
  <teleport to="body">
    <section
      ref="card"
      class="details"
      :style="{ left: `${left}px`, top: `${top}px` }"
      :aria-label="t('quest.board.detailsLabel', { name: t(row.quest.nameKey) })"
      :data-testid="`quest-details-${row.quest.id}`"
      @mouseenter="details.keepOpen()"
      @mouseleave="pinned || details.leave()"
    >
      <header>
        <h3>{{ t(row.quest.nameKey) }}</h3>
        <button
          v-if="pinned"
          type="button"
          class="x"
          :data-testid="`quest-details-${row.quest.id}-close`"
          :aria-label="t('quest.board.detailsClose')"
          @click="details.closeAndFocusRow()"
        >
          ×
        </button>
      </header>
      <p class="tags">
        {{ t(`quest.board.filter.${row.category}`) }} ·
        {{ row.repeat === 'once' ? t('quest.once') : t('quest.repeatable') }}
      </p>
      <p class="desc">{{ t(row.quest.descKey) }}</p>
      <dl>
        <dt>{{ t('quest.board.label.goal') }}</dt>
        <dd>
          <template v-if="row.seeker">
            <span class="cells">
              <span>{{ t('quest.chip.steps', { n: row.seeker.steps }) }}</span>
              <span>{{ t('quest.chip.stepPrice', { n: row.seeker.stepCost }) }}</span>
              <span>{{ t('quest.chip.backPrice', { n: row.seeker.backCost }) }}</span>
            </span>
            <span class="note">{{ t('quest.board.expeditionNote') }}</span>
          </template>
          <template v-else-if="row.taken">
            <span class="bar" aria-hidden="true"><i :style="{ width: `${percent}%` }"></i></span>
            <span>{{ row.progress }} / {{ row.target }} {{ t(row.unitKey) }}</span>
          </template>
          <template v-else>{{
            t('quest.board.meta.goal', { n: row.target, unit: t(row.unitKey) })
          }}</template>
        </dd>
        <template v-if="row.lockedByKey && row.state === 'locked'">
          <dt>{{ t('quest.board.label.requires') }}</dt>
          <dd class="bad">✗ {{ t('quest.lockedBy', { name: t(row.lockedByKey) }) }}</dd>
        </template>
        <dt>{{ t('quest.board.label.reward') }}</dt>
        <dd class="rewards">
          <span v-for="(reward, index) in row.rewards" :key="index" class="pill">
            <quest-reward-icon :reward="reward" />{{ rewardText(reward) }}
          </span>
        </dd>
        <template v-if="row.state !== 'locked'">
          <dt>{{ row.taken ? t('quest.board.label.taken') : t('quest.board.label.toTake') }}</dt>
          <dd :data-testid="`quest-details-${row.quest.id}-cost`">{{ costText }}</dd>
        </template>
      </dl>
      <p
        v-if="reasonText"
        class="reason"
        role="status"
        :data-testid="
          row.reason === 'will'
            ? `quest-short-${row.quest.id}`
            : `quest-details-${row.quest.id}-reason`
        "
      >
        {{ reasonText }}
      </p>
      <footer>
        <button
          v-if="row.taken"
          type="button"
          class="ghost"
          :data-testid="`quest-abandon-${row.quest.id}`"
          :disabled="busy"
          @click="onAbandon"
        >
          {{ t('quest.board.abandon') }}
        </button>
        <button
          v-if="row.ready"
          type="button"
          class="main claim"
          :data-testid="`quest-details-${row.quest.id}-claim`"
          :disabled="busy"
          @click="actions.claim(row)"
        >
          {{ t('quest.board.claimReward') }}
        </button>
        <button
          v-else-if="row.taken && row.seeker"
          type="button"
          class="main"
          :data-testid="`quest-details-${row.quest.id}-enter`"
          :disabled="busy"
          @click="actions.enter(row)"
        >
          {{ t('quest.board.enterTrail') }}
        </button>
        <button
          v-else-if="row.state === 'open'"
          type="button"
          class="main"
          :data-testid="`quest-details-${row.quest.id}-start`"
          :disabled="busy || row.reason === 'will'"
          @click="actions.take(row)"
        >
          {{ t('quest.start') }}
        </button>
      </footer>
    </section>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { QUEST_SLOTS } from '@hexoflat/engine/quests/quest-definition';
import { useHeroStore } from '@/stores/hero-store';
import type { QuestRowView } from '@/composables/use-quest-board-view';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestRowActions } from '@/composables/use-quest-row-actions';
import QuestRewardIcon from './quest-reward-icon.vue';
import { rewardText } from './quest-reward-text';

const WIDTH = 400;
const GAP = 10;
const MARGIN = 8;

const props = defineProps<{ row: QuestRowView; anchor: DOMRect; pinned: boolean }>();
const { t } = useI18n();
const details = useQuestDetails();
const hero = useHeroStore();
const actions = useQuestRowActions();
const { busy } = actions;

const card = ref<HTMLElement | null>(null);
const top = ref(props.anchor.top);
const left = computed(() => Math.max(MARGIN, props.anchor.left - WIDTH - GAP));

const percent = computed(() =>
  Math.min(100, (props.row.progress / Math.max(1, props.row.target)) * 100),
);

const reasonText = computed(() => {
  if (props.row.reason === 'slots')
    return t('quest.board.reason.slotsFull', { max: QUEST_SLOTS.max });
  if (props.row.reason === 'will') {
    return t('quest.board.reason.willNeed', {
      need: props.row.price,
      have: hero.knowledge?.current ?? 0,
    });
  }
  return null;
});

const costText = computed(() => {
  const row = props.row;
  if (row.taken) return t('quest.board.takenNote');
  if (row.price <= 0) return t('quest.board.cost.free');
  const parts: string[] = [];
  if (row.entry > 0) parts.push(t('quest.board.cost.entry', { n: row.entry }));
  if (row.surcharge > 0) {
    parts.push(t('quest.board.cost.slot', { slot: row.slotNumber, n: row.surcharge }));
  }
  return `${parts.join(' + ')} = ${t('quest.price.will', { n: row.price })}`;
});

function place() {
  const height = card.value?.getBoundingClientRect().height ?? 0;
  const fit = window.innerHeight - height - MARGIN;
  top.value = Math.max(MARGIN, Math.min(props.anchor.top, fit));
}

async function onAbandon() {
  const done = await actions.abandon(props.row);
  if (done) details.close();
}

onMounted(() => nextTick(place));
watch(
  () => [props.anchor, props.row.state, props.row.reason],
  () => nextTick(place),
);
</script>

<style scoped>
.details {
  --q-text: #ede3d2;
  --q-muted: #cbbfa6;
  --q-label: #a9a08f;
  --q-gold: #f0c060;
  --q-gold-text: #e8d7a8;
  --q-raised: #262e33;
  --q-bg: #121517;
  --q-danger-bg: #2e1f1b;
  --q-danger-text: #f2b3a2;
  position: fixed;
  z-index: 60;
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100vw - 16px);
  padding: 16px;
  color: var(--q-text);
  background: var(--q-raised);
  border: 1px solid #6b5a33;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-family: 'Cinzel', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--q-gold-text);
}
.x {
  width: 32px;
  min-height: 32px;
  height: 32px;
  padding: 0;
  font-size: 20px;
  color: var(--q-muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.tags {
  margin: 2px 0 8px;
  font-size: 13px;
  color: var(--q-label);
}
.desc {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.35;
}
dl {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 10px 8px;
  margin: 0;
}
dt {
  padding-top: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--q-label);
}
dd {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  font-size: 14px;
  color: var(--q-muted);
}
dd.bad {
  color: var(--q-danger-text);
}
.cells {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cells span {
  padding: 2px 8px;
  border: 1px solid #36424a;
  border-radius: 8px;
}
.note {
  font-size: 13px;
  color: var(--q-label);
}
.bar {
  display: block;
  height: 6px;
  overflow: hidden;
  background: var(--q-bg);
  border-radius: 3px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--q-gold);
}
.rewards {
  flex-direction: column;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--q-text);
  background: var(--q-bg);
  border-radius: 8px;
}
.reason {
  margin: 12px 0 0;
  padding: 8px 10px;
  font-size: 14px;
  color: var(--q-danger-text);
  background: var(--q-danger-bg);
  border-radius: 8px;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
footer button {
  min-height: 40px;
  height: 40px;
  padding: 0 16px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
}
.main {
  color: var(--q-text);
  background: #343f46;
  border: 1px solid #6b5a33;
}
.main.claim {
  color: #1b1408;
  background: var(--q-gold);
  border-color: var(--q-gold);
}
.ghost {
  color: var(--q-muted);
  background: none;
  border: 1px solid #36424a;
}
footer button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
