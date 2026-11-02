<template>
  <div
    class="creature-row"
    :class="[
      `is-${row.side}`,
      { 'is-fallen': row.fallen, 'is-target': row.targeted, 'is-selected': row.selected },
    ]"
    :data-testid="`battle-row-${row.id}`"
    @click="emit('select', row.id)"
  >
    <battle-hex-token
      :side="row.side"
      :kind="row.behaviour"
      :init="row.init"
      :active="row.active"
      :fallen="row.fallen"
      :plain="row.side === 'enemies'"
    />
    <div class="creature-row__main">
      <div class="creature-row__title">
        <span class="creature-row__name">{{ row.name }}</span>
        <span v-for="tag in row.tags" :key="tag" class="creature-row__tag" :class="`is-${tag}`">
          {{ t(`battle.tag.${tag}`) }}
        </span>
        <span
          v-if="row.selected"
          class="creature-row__tag is-selected"
          :data-testid="`battle-row-selected-${row.id}`"
        >
          {{ t('battle.tag.selected') }}
        </span>
        <span
          v-if="row.block && !row.fallen"
          class="creature-row__tag is-block"
          :class="`is-${row.block}`"
          :data-testid="`battle-row-block-${row.id}`"
        >
          {{ row.block === 'ready' ? t('battle.block.ready') : t('battle.block.blocking') }}
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
      <span v-if="row.side === 'enemies'" class="creature-row__hands">
        <span
          v-for="slot in row.hands"
          :key="slot.hand"
          class="creature-row__hand"
          :class="{ 'is-empty': !slot.itemKey }"
          :title="handTitle(slot)"
          :data-testid="`battle-row-hand-${slot.hand}-${row.id}`"
          :data-tool="slot.toolKey"
        >
          <span class="creature-row__hand-art" :style="handArt(slot)"></span>
        </span>
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
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { BattleRowHand } from '@/composables/battle-row-hands';

defineProps<{ row: BattleCreatureRow }>();

function handArt(slot: BattleRowHand) {
  const path = getPrototype(slot.toolKey as THexobjectKey).spritePath;
  return path ? { backgroundImage: `url('${path}')` } : {};
}

function handTitle(slot: BattleRowHand): string {
  const name = slot.itemKey ? t(`content.battle.${slot.itemKey}.title`) : t('battle.hand.empty');
  return `${t(`battle.hand.${slot.hand}`)}: ${name}`;
}
const emit = defineEmits<{ select: [id: string] }>();
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
.creature-row.is-enemies {
  cursor: pointer;
}
.creature-row.is-selected {
  border-color: #e0463d;
  box-shadow: 0 0 0 1px #e0463d inset;
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
.creature-row__tag.is-selected {
  background: #6b1a16;
  border: 1px solid #e0463d;
  color: #ffc4be;
}
.creature-row__tag.is-block {
  background: #1f3a5a;
  border: 1px solid #5d93cf;
  color: #bcdcff;
}
.creature-row__tag.is-ready {
  background: #1d4a2c;
  border-color: #5fbf7e;
  color: #c3f2d2;
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
.creature-row__hands {
  display: flex;
  gap: 4px;
}
.creature-row__hand {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #121517;
  border: 1px solid #36424a;
}
.creature-row__hand.is-empty {
  opacity: 0.6;
}
.creature-row__hand-art {
  width: 20px;
  height: 20px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}
.creature-row__role {
  white-space: nowrap;
}
</style>
