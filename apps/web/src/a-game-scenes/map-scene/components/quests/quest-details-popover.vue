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
      <p v-if="row.timesDone > 0" class="tags">
        {{ t('quest.board.doneTimes', { n: row.timesDone }) }}
      </p>
      <i class="line" aria-hidden="true"></i>
      <p class="desc">{{ t(row.quest.descKey) }}</p>
      <dl>
        <dt>{{ t('quest.board.label.goal') }}</dt>
        <dd>
          <template v-if="row.seeker">
            <span class="cells" :data-testid="`quest-chips-${row.quest.id}`">
              <span>{{ t('quest.chip.entry', { n: row.seeker.entry }) }}</span>
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
          <template v-else
            ><span class="goal">{{
              t('quest.board.meta.goal', { n: row.target, unit: t(row.unitKey) })
            }}</span></template
          >
        </dd>

        <dt>{{ t('quest.board.label.reward') }}</dt>
        <dd class="rewards">
          <span v-for="(reward, index) in row.rewards" :key="index" class="pill">
            <quest-reward-icon :reward="reward" tooltip />{{ rewardText(reward) }}
          </span>
        </dd>
        <dt>{{ row.taken ? t('quest.board.label.taken') : t('quest.board.label.toTake') }}</dt>
        <dd :data-testid="`quest-details-${row.quest.id}-cost`">{{ costText }}</dd>
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
          {{ t('quest.board.return') }}
        </button>
        <quest-action-button
          v-if="row.ready"
          variant="main"
          :testid="`quest-details-${row.quest.id}-claim`"
          :disabled="busy"
          @click="actions.claim(row)"
        >
          {{ t('quest.board.claimReward') }}
        </quest-action-button>
        <quest-action-button
          v-else-if="row.taken && row.seeker"
          variant="main"
          :testid="`quest-details-${row.quest.id}-enter`"
          :disabled="busy"
          @click="actions.enter(row)"
        >
          {{ t('quest.board.enterTrail') }}
        </quest-action-button>
        <quest-action-button
          v-else-if="row.state === 'open'"
          variant="main"
          :testid="`quest-details-${row.quest.id}-start`"
          :disabled="busy || row.reason === 'will'"
          @click="actions.take(row)"
        >
          {{ t('quest.start') }}
        </quest-action-button>
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
import QuestActionButton from './quest-action-button.vue';
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
  --q-display: 'Cormorant Garamond', Georgia, serif;
  --q-label: rgba(241, 228, 204, 0.6);
  position: fixed;
  z-index: 60;
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100vw - 16px);
  padding: 12px 14px;
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(241, 228, 204, 0.95);
  background: rgba(14, 11, 9, 0.97);
  border: 1px solid rgba(122, 141, 160, 0.7);
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.65);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-size: 1.35em;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  color: #ffe98a;
  text-shadow:
    0 0 8px rgba(255, 233, 138, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.8);
}
.x {
  width: 32px;
  min-height: 32px;
  height: 32px;
  padding: 0;
  font-size: 22px;
  color: rgba(241, 228, 204, 0.8);
  background: none;
  border: 0;
  cursor: pointer;
}
.tags {
  margin: 2px 0 6px;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--q-label);
}
.line {
  display: block;
  height: 1px;
  margin-bottom: 8px;
  background: linear-gradient(90deg, rgba(122, 141, 160, 0.7), transparent);
}
.desc {
  margin: 0 0 10px;
}
dl {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
}
dt {
  padding-top: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--q-label);
}
dd {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
}
.goal {
  color: #8fcb9a;
}
dd.bad {
  color: #f2b3a2;
}
.cells {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cells span {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(122, 141, 160, 0.4);
  border-radius: 6px;
}
.note {
  color: var(--q-label);
}
.bar {
  display: block;
  height: 6px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
}
.bar i {
  display: block;
  height: 100%;
  background: #ffe98a;
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
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(122, 141, 160, 0.4);
  border-radius: 6px;
}
.reason {
  margin: 10px 0 0;
  padding: 8px 10px;
  color: #f2b3a2;
  background: #2e1f1b;
  border: 1px solid #5a3328;
  border-radius: 6px;
}
footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}
.ghost {
  min-height: 42px;
  height: 42px;
  padding: 0 16px;
  font-family: var(--q-display);
  font-size: 18px;
  font-weight: 700;
  color: rgba(241, 228, 204, 0.85);
  background: transparent;
  border: 1px solid rgba(122, 141, 160, 0.5);
  border-radius: 8px;
  cursor: pointer;
}
.ghost:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
