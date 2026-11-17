<template>
  <teleport to="body">
    <section
      ref="card"
      class="details"
      :style="{ left: `${left}px`, top: `${top}px` }"
      :aria-label="t('quest.board.detailsLabel', { name: t(row.quest.nameKey) })"
      :data-testid="`quest-details-${row.quest.id}`"
      @mouseenter="details.keepOpen()"
      @mouseleave="details.leave()"
    >
      <header>
        <h3>{{ t(row.quest.nameKey) }}</h3>
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
            <span class="goal">{{ t(row.quest.tableRule) }}</span>
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
        <dt>{{ t('quest.board.label.rule') }}</dt>
        <dd :data-testid="`quest-details-${row.quest.id}-rule`">{{ ruleText }}</dd>
        <template v-if="row.taken">
          <dt>{{ t('quest.board.label.how') }}</dt>
          <dd :data-testid="`quest-details-${row.quest.id}-how`">
            <ol class="steps">
              <li v-for="(step, index) in steps" :key="index">{{ step }}</li>
            </ol>
          </dd>
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
        <p v-else-if="row.taken && row.seeker">{{ t('quest.findInSilesia') }}</p>
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
import { useHeroStore } from '@/stores/hero-store';
import type { QuestRowView } from '@/composables/use-quest-board-view';
import { questRuleParams } from '@/services/quests/quest-rule-params';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useQuestRowActions } from '@/composables/use-quest-row-actions';
import QuestActionButton from './quest-action-button.vue';
import QuestRewardIcon from './quest-reward-icon.vue';
import { rewardText } from './quest-reward-text';

const WIDTH = 400;
const GAP = 10;
const MARGIN = 8;

const props = defineProps<{ row: QuestRowView; anchor: DOMRect }>();
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
  if (props.row.reason === 'will') {
    return t('quest.board.reason.willNeed', {
      need: props.row.price,
      have: hero.knowledge?.current ?? 0,
    });
  }
  return null;
});

const ruleText = computed(() =>
  t(`quest.${props.row.quest.id}.rule`, { ...questRuleParams(props.row.quest) }),
);

const steps = computed(() => t(`quest.${props.row.quest.id}.how`).split('\n'));

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
  gap: 0 8px;
  margin: 0;
}
dl > :nth-child(n + 3) {
  border-top: 1px solid rgba(122, 141, 160, 0.28);
}
dl > dd {
  padding: 10px 0;
}
dl > dt {
  padding: 14px 0 10px;
}
dl > :nth-child(-n + 2) {
  padding-top: 2px;
}
dt {
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
.steps {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}
.steps li::marker {
  font-weight: 700;
  color: #f5c26b;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
}
.reason {
  margin: 0;
  padding: 10px 0;
  color: #f2b3a2;
  border-top: 1px solid rgba(122, 141, 160, 0.28);
}
footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}
html:not(.is-grabbing) .details,
html:not(.is-grabbing) .details :deep(*) {
  cursor:
    url('/cursors/app-cursor/cursor-default.svg') 3 0,
    auto !important;
}
.ghost {
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  --edge: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  position: relative;
  isolation: isolate;
  min-height: 42px;
  height: 42px;
  padding: 0 22px;
  font-family: var(--q-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #f3e8d2;
  background: var(--edge);
  border: 0;
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
.ghost::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--face);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
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
.ghost:not(:disabled):hover {
  --face: linear-gradient(180deg, #4a5d6e, #34444f);
}
.ghost:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 3px;
}
.ghost:disabled {
  --face: linear-gradient(180deg, #34383d, #26292d);
  --edge: linear-gradient(180deg, #4a4f55, #2a2d31);
  color: #a3a8ae;
}
</style>
