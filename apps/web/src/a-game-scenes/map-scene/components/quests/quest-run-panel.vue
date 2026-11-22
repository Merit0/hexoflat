<template>
  <div class="run" data-testid="quest-run-panel">
    <div v-if="run || result" class="will">
      <h3>{{ t(run?.nameKey ?? result?.nameKey ?? '') }}</h3>
      <span class="separator" aria-hidden="true"></span>
      <span class="will-counter" :aria-label="t('quest.board.will')">
        <img :src="WILL_ICON_URL" alt="" aria-hidden="true" />
        <span>
          <WillNumber :current="hero.knowledge?.current ?? 0" /> /
          {{ hero.knowledge?.capacity ?? 0 }}
        </span>
      </span>
    </div>
    <article v-if="run" class="card" data-testid="quest-run-card" :data-phase="run.phase">
      <p class="status" data-testid="quest-run-status">
        {{ t('quest.run.statusLabel') }}:
        <span v-if="run.lost || run.phase === 'ambush'" class="is-wasted">{{
          t('quest.run.statusWasted')
        }}</span>
        <span v-else-if="run.projection.chest || run.phase === 'collect'" class="is-finished">{{
          t('quest.run.statusFinished')
        }}</span>
        <span v-else>{{ t('quest.run.statusInProgress') }}</span>
      </p>
      <DimensionLabel v-if="run.projection.dimension" :dimension="run.projection.dimension" />
      <p class="step" data-testid="quest-run-step">
        {{ t('quest.run.step', { n: run.step, total: run.steps }) }}
      </p>
      <p class="chips">
        <span>{{ t('quest.chip.stepPrice', { n: run.stepCost }) }}</span>
        <span>{{ t('quest.chip.backPrice', { n: run.backCost }) }}</span>
      </p>
      <QuestTrail
        :numbers="run.trail"
        :answer-review="run.projection.answerReview"
        testid="quest-trail-row"
      />
      <p v-if="run.descKey" class="desc">{{ t(run.descKey) }}</p>
      <dl class="info" data-testid="quest-run-details">
        <template v-if="run.goalKey">
          <dt>{{ t('quest.board.label.goal') }}</dt>
          <dd class="goal">{{ t(run.goalKey) }}</dd>
        </template>
        <dt>{{ t('quest.board.label.rule') }}</dt>
        <dd data-testid="quest-run-rule">{{ t(`quest.${run.questId}.rule`, run.ruleParams) }}</dd>
        <dt>{{ t('quest.board.label.how') }}</dt>
        <dd data-testid="quest-run-how">
          <ol class="how">
            <li v-for="(line, index) in howLines(run.questId)" :key="index">{{ line }}</li>
          </ol>
        </dd>
      </dl>
      <template v-if="run.lost">
        <p class="note" data-testid="quest-run-lost">{{ t('quest.run.lost') }}</p>
        <p class="note" data-testid="quest-run-lost-hint">{{ t('quest.run.lostHint') }}</p>
      </template>
      <p v-else-if="run.phase === 'collect'" class="note">{{ t('quest.run.collect') }}</p>
      <p v-else-if="run.phase === 'ambush'" class="note">{{ t('quest.run.ambush') }}</p>
      <p v-else-if="run.projection.chest" class="note">{{ t('quest.run.chestSeen') }}</p>
      <div class="buttons">
        <QuestActionButton
          v-if="run.phase === 'collect'"
          variant="main"
          testid="quest-return-to-camp"
          :disabled="busy"
          @click="giveReturn"
        >
          {{ t('quest.run.return') }}
        </QuestActionButton>
        <QuestActionButton
          v-if="run.lost"
          variant="main"
          testid="quest-leave-map"
          :disabled="busy"
          @click="leave"
        >
          {{ t('quest.run.leaveMap') }}
        </QuestActionButton>
        <template v-if="run.canGiveUp">
          <QuestActionButton
            v-if="!confirming"
            variant="main"
            testid="quest-give-up"
            :disabled="busy"
            @click="confirming = true"
          >
            {{ t('quest.run.giveUp') }}
          </QuestActionButton>
          <template v-else>
            <QuestActionButton
              variant="main"
              testid="quest-give-up-confirm"
              :disabled="busy"
              @click="leave"
            >
              {{ t('quest.run.giveUpConfirm') }}
            </QuestActionButton>
            <QuestActionButton
              variant="main"
              testid="quest-give-up-cancel"
              @click="confirming = false"
            >
              {{ t('quest.run.giveUpCancel') }}
            </QuestActionButton>
          </template>
        </template>
      </div>
    </article>
    <article
      v-else-if="result"
      class="card result"
      data-testid="quest-result"
      :data-outcome="result.outcome"
    >
      <p class="outcome">{{ t(`quest.result.${result.outcome}`) }}</p>
      <QuestTrail
        :numbers="result.numbers"
        :answer-review="result.answerReview"
        testid="quest-result-trail"
      />
      <p v-if="result.firstDeviation" class="note" data-testid="quest-result-review">
        {{
          t('quest.result.review', {
            took: result.firstDeviation.number,
            rule: result.firstDeviation.expected,
          })
        }}
      </p>
      <div class="buttons">
        <QuestActionButton
          variant="main"
          testid="quest-result-dismiss"
          @click="dismissQuestResult()"
        >
          {{ t('quest.result.dismiss') }}
        </QuestActionButton>
      </div>
    </article>
    <p v-if="message" role="alert" class="message" data-testid="quest-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import DimensionLabel from '@/components/gui/dimension-label.vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import QuestActionButton from './quest-action-button.vue';
import QuestTrail from './quest-trail.vue';
import { dismissQuestResult } from '@/services/quests/quest-result';
import { useHeroStore } from '@/stores/hero-store';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import WillNumber from '@/components/gui/will-number.vue';

const { t } = useI18n();
const hero = useHeroStore();
const { run, result } = useQuestRunView();
const { message, busy, giveUp, returnToCamp } = useQuestRunActions();
const confirming = ref(false);

async function leave() {
  confirming.value = false;
  await giveUp();
}
function howLines(id: string): string[] {
  return t(`quest.${id}.how`).split('\n');
}
async function giveReturn() {
  await returnToCamp();
}
</script>

<style scoped>
.run {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 1.05rem;
  line-height: 1.45;
  color: #f1e4cc;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #3a4a58;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
}
.will {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #3a4a58;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 1.2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.will h3 {
  font-size: 1.3rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.separator {
  align-self: stretch;
  margin: 4px 0;
  background: #3a4a58;
}
.will-counter {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.will img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
h3,
p {
  margin: 0;
}
h3 {
  font-size: 1.6rem;
  color: #ffe98a;
}
.step {
  font-size: 1.3rem;
  font-weight: 700;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 1rem;
}
.chips span {
  padding: 3px 12px;
  border: 1px solid #3a4a58;
  border-radius: 999px;
}
.note,
.outcome {
  font-size: 1.05rem;
}
.desc {
  font-size: 1.05rem;
}
.info {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  margin: 0;
}
.info dt {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(122, 141, 160, 0.28);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(241, 228, 204, 0.6);
}
.info dd {
  margin: 0;
}
.goal {
  color: #8fcb9a;
}
.status span {
  font-weight: 700;
}
.is-finished {
  color: #8fcb9a;
}
.is-wasted,
.card[data-phase='lost'] .step,
.card[data-phase='lost'] .goal {
  color: #ff9d8a;
}
.how {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 22px;
}
.how li::marker {
  font-weight: 700;
  color: #f5c26b;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}
.message {
  color: #ff9d8a;
  font-size: 1rem;
}
</style>
