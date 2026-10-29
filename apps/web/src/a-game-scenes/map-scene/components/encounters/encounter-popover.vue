<template>
  <div
    v-if="view"
    class="popover"
    :class="{ 'is-left': opensLeft }"
    :style="placement"
    data-testid="encounter-popover"
    @pointerdown.stop
    @click.stop
  >
    <header class="popover__head">
      <span class="popover__title">{{ t(view.title) }}</span>
      <span class="popover__threat" :class="`is-${view.threat}`">
        {{ t(`encounter.threat.${view.threat}`) }}
      </span>
      <button
        class="popover__close"
        type="button"
        :aria-label="t('encounter.close')"
        data-testid="encounter-popover-close"
        @click="store.select(null)"
      >
        ×
      </button>
    </header>
    <ul class="popover__members">
      <li
        v-for="(member, index) in members"
        :key="index"
        class="popover__member"
        :data-testid="`encounter-member-${index}`"
      >
        <encounter-token
          :leader-kind="member.kind ?? view.leaderKind"
          :count="1"
          :threat="view.threat"
          :scouted="true"
          :sentry="false"
          :boss="view.boss && index === 0"
          :is-loot="false"
          size="list"
        />
        <span v-if="index === 0" class="popover__leader">★</span>
        <span class="popover__name">{{ member.name }}</span>
        <span class="popover__meta">{{ member.meta }}</span>
      </li>
    </ul>
    <p v-if="view.sentry" class="popover__sentry">{{ t('encounter.sentryNote') }}</p>
    <div class="popover__actions">
      <button
        class="popover__action is-attack"
        type="button"
        :disabled="!store.canAct"
        data-testid="encounter-attack"
        @click="store.attack(view.id)"
      >
        <span>{{ t('encounter.attack') }}</span>
        <small>{{ t('encounter.attackCost', { will: rules.attackWill }) }}</small>
      </button>
      <button
        class="popover__action"
        type="button"
        :disabled="!store.canAct || view.scouted"
        data-testid="encounter-scout"
        @click="store.scout(view.id)"
      >
        <span>{{ t('encounter.scout') }}</span>
        <small>{{ t('encounter.scoutCost', { will: rules.scoutWill }) }}</small>
      </button>
      <button
        class="popover__action"
        type="button"
        :disabled="!store.canAct"
        data-testid="encounter-sneak"
        @click="store.startSneak(view.id)"
      >
        <span>{{ t('encounter.sneak') }}</span>
        <small>{{ t('encounter.sneakCost', { seconds: rules.sneakMs / 1000 }) }}</small>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_CREATURES } from '@hexoflat/engine/battle/battle-catalogue';
import { ENCOUNTER_RULES } from '@hexoflat/engine/encounters/encounter-content';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { useEncounterStore } from '@/stores/encounter-store';
import EncounterToken from './encounter-token.vue';

const props = defineProps<{ tileWidth: number; tileHeight: number; boardWidth: number }>();

const POPOVER_WIDTH = 300;
const { t } = useI18n();
const store = useEncounterStore();
const rules = ENCOUNTER_RULES;
const view = computed(() => store.selected);

const anchor = computed(() =>
  view.value
    ? calcHexPixelPosition(
        { coordinates: view.value.coordinates },
        props.tileWidth,
        props.tileHeight,
      )
    : { x: 0, y: 0 },
);
const opensLeft = computed(
  () => anchor.value.x + props.tileWidth + POPOVER_WIDTH > props.boardWidth,
);
const placement = computed(() => ({
  top: `${anchor.value.y}px`,
  left: opensLeft.value
    ? `${anchor.value.x - POPOVER_WIDTH - 8}px`
    : `${anchor.value.x + props.tileWidth + 8}px`,
  width: `${POPOVER_WIDTH}px`,
}));

const members = computed(() =>
  (view.value?.members ?? []).map((kind) => {
    const def = kind ? BATTLE_CREATURES[kind] : null;
    return {
      kind,
      name: kind ? t(`content.battle.${kind}.title`) : t('encounter.unknown'),
      meta: def ? `${def.hp / 2} ♥ · ${t(`battle.roleShort.${def.behaviour}`)}` : '?',
    };
  }),
);
</script>

<style scoped>
.popover {
  position: absolute;
  z-index: 130;
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid #b0306a;
  background: #15171c;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
  pointer-events: auto;
}
.popover__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.popover__title {
  flex: 1;
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-weight: 700;
}
.popover__threat {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid currentColor;
}
.popover__threat.is-easy {
  color: #a8c98e;
}
.popover__threat.is-risky {
  color: #f0c060;
}
.popover__threat.is-deadly {
  color: #f07a6a;
}
.popover__close {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid #36424a;
  background: #121517;
  color: #cbbfa6;
  cursor: pointer;
}
.popover__members {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 8px;
  list-style: none;
  border-radius: 12px;
  background: #1c2125;
  border: 1px solid #36424a;
}
.popover__member {
  display: flex;
  align-items: center;
  gap: 8px;
}
.popover__leader {
  color: #f0c060;
}
.popover__name {
  flex: 1;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.85rem;
}
.popover__meta {
  color: #8e9599;
  font-size: 0.8rem;
}
.popover__sentry {
  margin: 0;
  color: #ff8a7a;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.85rem;
}
.popover__actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.popover__action {
  display: grid;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 12px;
  border: 1px solid #36424a;
  background: #262e33;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}
.popover__action small {
  color: #8e9599;
  font-family: 'Alegreya Sans', sans-serif;
  font-weight: 400;
  text-transform: none;
}
.popover__action.is-attack {
  border-color: #b0306a;
  background: linear-gradient(180deg, #8c1c47, #5a0f2c);
}
.popover__action:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
