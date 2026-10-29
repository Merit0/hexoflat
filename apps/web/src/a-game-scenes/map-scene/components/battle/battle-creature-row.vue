<template>
  <div
    class="creature-row"
    :class="[`is-${row.side}`, { 'is-fallen': row.fallen, 'is-target': row.targeted }]"
    :data-testid="`battle-row-${row.id}`"
  >
    <battle-hex-token
      :side="row.side"
      :kind="row.behaviour"
      :init="row.init"
      :active="row.active"
      :fallen="row.fallen"
    />
    <div class="creature-row__main">
      <div class="creature-row__title">
        <span class="creature-row__name">{{ row.name }}</span>
        <span v-for="tag in row.tags" :key="tag" class="creature-row__tag" :class="`is-${tag}`">
          {{ t(`battle.tag.${tag}`) }}
        </span>
        <span
          v-if="row.hits && !row.fallen"
          class="creature-row__tag is-hit"
          :data-testid="`battle-row-hit-${row.id}`"
        >
          {{ t('battle.tag.hit', { count: row.hits }) }}
        </span>
      </div>
      <battle-hearts :hp="row.hp" :max-hp="row.maxHp" :size="18" />
    </div>
    <div class="creature-row__side">
      <span v-if="row.side === 'enemies'" class="creature-row__shields">
        <span
          v-for="n in 6"
          :key="n"
          class="creature-row__shield"
          :class="{ 'is-filled': n <= row.shields }"
        ></span>
      </span>
      <span v-if="row.side === 'enemies'" class="creature-row__role">
        {{ t(`battle.role.${row.behaviour}`) }}
      </span>
      <span v-else class="creature-row__role">
        {{ t('battle.row.stance', { will: row.stance }) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleCreatureRow } from '@/composables/battle-view-types';
import BattleHexToken from './battle-hex-token.vue';
import BattleHearts from './battle-hearts.vue';

defineProps<{ row: BattleCreatureRow }>();
const { t } = useI18n();
</script>

<style scoped>
.creature-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 14px;
  background: #262e33;
  border: 1px solid #36424a;
}
.creature-row.is-enemies {
  box-sizing: border-box;
  height: calc(46px + 20px + 2px);
  padding: 10px 12px;
}
.creature-row.is-target {
  border-color: #e0a93f;
}
.creature-row.is-fallen {
  opacity: 0.45;
}
.creature-row__main {
  flex: 1;
  display: grid;
  gap: 4px;
  min-width: 0;
}
.creature-row__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.creature-row__name {
  text-transform: uppercase;
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-size: 0.95rem;
  font-weight: 700;
}
.is-fallen .creature-row__name {
  text-decoration: line-through;
}
.creature-row__tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: #3a474e;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.creature-row__tag.is-hit {
  background: #5a1a14;
  border: 1px solid #c2412d;
  color: #ffb4a6;
}
.creature-row__tag.is-yourTurn {
  background: #8c1c47;
}
.creature-row__side {
  display: grid;
  justify-items: end;
  gap: 4px;
  color: #8e9599;
  font-size: 0.75rem;
}
.creature-row__shields {
  display: flex;
  gap: 3px;
}
.creature-row__shield {
  width: 11px;
  height: 12px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: #34465a;
}
.creature-row__shield.is-filled {
  background: linear-gradient(160deg, #8fc0f0, #3a6aa8);
}
.creature-row__role {
  white-space: nowrap;
}
</style>
