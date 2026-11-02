<template>
  <div
    class="hero-card"
    :class="{ 'is-turn': card.state === 'act' || card.state === 'aim' }"
    data-testid="battle-hero-controls"
    :data-state="card.state"
  >
    <header class="hero-card__head">
      <battle-hex-token
        side="heroes"
        :init="card.row.init"
        :active="card.row.active"
        :fallen="card.row.fallen"
      />
      <div class="hero-card__who">
        <div class="hero-card__title">
          <span class="hero-card__name">{{ card.row.name }}</span>
          <span
            v-if="card.row.tags.includes('yourTurn')"
            class="hero-card__tag"
            data-testid="battle-tag-your-turn"
          >
            {{ t('battle.tag.yourTurn') }}
          </span>
          <span v-if="card.row.hits" class="hero-card__tag is-hit">
            {{ t('battle.tag.hit', { count: card.row.hits }) }}
          </span>
        </div>
        <battle-hearts :hp="card.row.hp" :max-hp="card.row.maxHp" />
      </div>
      <div class="hero-card__will">
        <img class="hero-card__will-icon" :src="WILL_ICON_URL" alt="" />
        <div class="hero-card__will-value" data-testid="battle-will-value">
          <will-number :current="card.will" /> / {{ card.willCap }}
        </div>
        <div class="hero-card__will-bar">
          <span :style="{ width: `${willPercent}%` }"></span>
        </div>
      </div>
    </header>

    <section v-if="card.state === 'defend' && card.defend" class="hero-card__body">
      <p class="hero-card__text" data-testid="battle-act-hint">
        <template v-if="card.hint">{{ text(card.hint) }}</template>
        <template v-else>
          {{
            t('battle.defend.struck', { name: card.defend.attacker, count: card.defend.strikes })
          }}
          <b>{{ t('battle.defend.guess') }}</b>
          {{ t('battle.defend.tapRed') }}
        </template>
      </p>
      <div class="hero-card__shields">
        <span
          v-for="n in card.defend.capacity"
          :key="n"
          class="hero-card__shield"
          :class="{ 'is-placed': n <= card.defend.placed }"
        ></span>
        <b data-testid="battle-shield-count"
          >{{ card.defend.placed }} / {{ card.defend.capacity }}</b
        >
        <span v-if="card.defend.shieldKey" class="hero-card__note">
          {{
            t('battle.defend.shieldNote', {
              shield: t(`content.battle.${card.defend.shieldKey}.title`),
              stance: card.stanceGain,
            })
          }}
        </span>
        <span v-else class="hero-card__note">{{ t('battle.defend.noShield') }}</span>
      </div>
      <div
        class="hero-card__timer"
        data-testid="battle-reaction-timer"
        :style="timerStyle(card.defend.deadlineMs)"
      ></div>
      <div class="hero-card__defend-buttons">
        <button
          class="hero-card__btn"
          type="button"
          data-testid="battle-take-hit"
          @click="emit('take-hit')"
        >
          {{ t('battle.defend.takeHit') }}
        </button>
      </div>
    </section>

    <section v-else-if="card.state === 'aim' && card.aim" class="hero-card__body">
      <p class="hero-card__text" data-testid="battle-aim-hint">
        {{ card.aim.shieldsRaised ? t('battle.aim.text') : t('battle.aim.none') }}
      </p>
      <div
        class="hero-card__timer"
        data-testid="battle-reaction-timer"
        :style="timerStyle(card.aim.deadlineMs)"
      ></div>
    </section>

    <section v-else-if="card.state === 'act'" class="hero-card__body">
      <template v-if="card.stage === 'action'">
        <battle-hand-row
          v-for="hand in card.hands"
          :key="hand.hand"
          :hand="hand"
          @pick="emit('pick-hand', $event)"
        />
        <battle-action-buttons :actions="card.actions" @pick="emit('pick-action', $event)" />
      </template>
      <div v-if="swapping && card.stage === 'action'" class="hero-card__bag">
        <button
          v-for="item in card.bag"
          :key="item.index"
          class="hero-card__bag-item"
          type="button"
          :data-testid="`battle-bag-item-${item.index}`"
          @click="emit('swap', item.index)"
        >
          {{ t(`content.battle.${item.key}.title`) }}
        </button>
      </div>
      <div
        class="hero-card__cost"
        :class="{ 'is-planned': card.turnCost > 0, 'is-too-high': card.costTooHigh }"
        data-testid="battle-turn-cost"
      >
        <span class="hero-card__cost-label">{{ t('battle.turnCost') }}</span>
        <span class="hero-card__cost-value">
          <img class="hero-card__cost-icon" :src="WILL_ICON_URL" alt="" />
          <b data-testid="battle-turn-cost-value">{{ card.turnCost }}</b>
        </span>
      </div>
      <div class="hero-card__turn-buttons">
        <button
          v-if="card.stage === 'move'"
          class="hero-card__btn"
          type="button"
          :disabled="!card.canUndo"
          data-testid="battle-undo"
          @click="emit('undo')"
        >
          {{ t('battle.undo') }}
        </button>
        <button
          class="hero-card__btn is-end"
          type="button"
          data-testid="battle-end-turn"
          @click="emit('end-turn')"
        >
          {{ t('battle.endTurn') }}
        </button>
      </div>
    </section>

    <section v-else class="hero-card__body">
      <p
        v-if="card.state === 'wait' && card.wait && card.wait.blocking"
        class="hero-card__text"
        data-testid="battle-wait-blocking"
      >
        {{ t('battle.waitBlocking', { name: card.wait.name }) }}
      </p>
      <p v-else-if="card.state === 'wait' && card.wait" class="hero-card__text">
        {{ t('battle.wait', { name: card.wait.name, init: card.wait.init }) }}
        <b>{{ t('battle.waitStance', { will: card.wait.stance }) }}</b>
      </p>
      <p v-else-if="card.state === 'victory'" class="hero-card__text">
        {{ t('battle.victory') }}
      </p>
      <p v-else class="hero-card__text">{{ t('battle.fallen', { name: card.row.name }) }}</p>
      <button
        v-if="card.state === 'victory' || card.state === 'defeat'"
        class="hero-card__btn is-end"
        type="button"
        data-testid="battle-leave"
        @click="emit('leave')"
      >
        {{ t('battle.leave') }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BattleHand } from '@hexoflat/engine/battle/battle-state';
import WillNumber from '@/components/gui/will-number.vue';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import type { BattleActionId, BattleHeroCard } from '@/composables/battle-hero-card';
import { useBattleText } from '@/composables/use-battle-view';
import BattleHexToken from './battle-hex-token.vue';
import BattleHearts from './battle-hearts.vue';
import BattleHandRow from './battle-hand-row.vue';
import BattleActionButtons from './battle-action-buttons.vue';

const props = defineProps<{ card: BattleHeroCard; swapping: boolean }>();
const emit = defineEmits<{
  'take-hit': [];
  'pick-hand': [hand: BattleHand];
  'pick-action': [id: BattleActionId];
  swap: [bagIndex: number];
  undo: [];
  'end-turn': [];
  leave: [];
}>();
const { t, text } = useBattleText();

function timerStyle(deadlineMs: number) {
  return { animationDuration: `${Math.max(0, deadlineMs - Date.now())}ms` };
}

const willPercent = computed(() =>
  props.card.willCap ? Math.min(100, Math.round((props.card.will / props.card.willCap) * 100)) : 0,
);
</script>

<style scoped>
.hero-card__timer {
  height: 4px;
  border-radius: 2px;
  background: #e0a93f;
  transform-origin: left;
  animation: hero-card-timer linear forwards;
}
@keyframes hero-card-timer {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
.hero-card__cost {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(180deg, #3a2f1c, #2a2418);
  border: 1px solid #b98a2e;
  box-shadow: 0 0 14px rgb(185 138 46 / 28%);
}
.hero-card__cost.is-planned .hero-card__cost-value {
  color: #fff6dc;
  text-shadow: 0 0 10px rgb(255 214 120 / 70%);
}
.hero-card__cost.is-too-high {
  border-color: #c2412d;
  box-shadow: 0 0 14px rgb(194 65 45 / 40%);
}
.hero-card__cost.is-too-high .hero-card__cost-value {
  color: #ff7a66;
  text-shadow: 0 0 10px rgb(255 90 70 / 60%);
}
.hero-card__cost-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #e6c27a;
}
.hero-card__cost-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 28px;
  line-height: 1;
  color: #ffe2a3;
}
.hero-card__cost-icon {
  width: 22px;
  height: 22px;
}
.hero-card {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #262e33;
  border: 1px solid #36424a;
}
.hero-card.is-turn {
  border-color: #b0306a;
  box-shadow: 0 0 18px rgb(140 28 71 / 45%);
  background: linear-gradient(180deg, #3a1a28, #262e33 45%);
}
.hero-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hero-card__who {
  flex: 1;
  display: grid;
  gap: 6px;
  min-width: 0;
}
.hero-card__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.hero-card__name {
  text-transform: uppercase;
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-size: 1.1rem;
  font-weight: 700;
}
.hero-card__tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: #8c1c47;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hero-card__tag.is-hit {
  background: #5a1a14;
  border: 1px solid #c2412d;
  color: #ffb4a6;
}
.hero-card__will {
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 104px;
  padding-left: 12px;
  border-left: 1px solid #36424a;
}
.hero-card__will-icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
}
.hero-card__will-value {
  color: #cbbfa6;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
}
.hero-card__will-value b {
  color: #e8d7a8;
  font-size: 1.4rem;
}
.hero-card__will-bar {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #121517;
  overflow: hidden;
}
.hero-card__will-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #5b3fe0, #9a6bff);
}
.hero-card__body {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #36424a;
}
.hero-card__text,
.hero-card__hint {
  margin: 0;
  color: #ede3d2;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.95rem;
}
.hero-card__text b {
  color: #ffb4a6;
}
.hero-card__hint {
  padding: 8px 12px;
  border-radius: 10px;
  background: #121517;
  color: #cbbfa6;
}
.hero-card__shields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #e8d7a8;
  font-family: Cinzel, serif;
}
.hero-card__shield {
  width: 24px;
  height: 26px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: #1a2026;
  outline: 1px dashed #3e5672;
}
.hero-card__shield.is-placed {
  background: linear-gradient(160deg, #8fc0f0, #3a6aa8);
}
.hero-card__note {
  color: #8e9599;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.8rem;
}
.hero-card__defend-buttons,
.hero-card__turn-buttons {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
}
.hero-card__turn-buttons {
  grid-template-columns: 1fr 2.4fr;
}
.hero-card__btn {
  text-transform: uppercase;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #4a5862;
  background: #1e2427;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.hero-card__btn.is-block {
  border-color: #4a8be0;
  background: linear-gradient(180deg, #3a5a8a, #2a3f63);
}
.hero-card__btn.is-end {
  border-color: #a0285a;
  background: linear-gradient(180deg, #7e1a40, #5a0f2c);
}
.hero-card__btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.hero-card__stance-note {
  color: #cbbfa6;
  font-family: 'Alegreya Sans', sans-serif;
  font-weight: 500;
  letter-spacing: 0;
}
.hero-card__bag {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hero-card__bag-item {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #4a8be0;
  background: #1a2a3c;
  color: #8fc0f0;
  font-family: Cinzel, serif;
  font-size: 0.75rem;
}
</style>
