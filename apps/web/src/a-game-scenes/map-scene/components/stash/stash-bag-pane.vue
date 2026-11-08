<template>
  <section class="pane" data-testid="stash-bag-pane" :aria-label="t('stash.bag')">
    <header class="head">
      <h3>{{ t('stash.bag') }}</h3>
      <span
        class="load"
        :class="{ 'is-heavy': isHeavy, 'is-over': isOver }"
        data-testid="stash-load-value"
        >{{ t('stash.weight', { current: carried, max: capacity }) }}</span
      >
    </header>
    <div class="loadbar" aria-hidden="true">
      <i :class="{ 'is-heavy': isHeavy, 'is-over': isOver }" :style="{ width: loadWidth }"></i>
    </div>

    <button
      type="button"
      class="equip-toggle"
      data-testid="stash-equip-toggle"
      :aria-expanded="!equipCollapsed"
      @click="equipCollapsed = !equipCollapsed"
    >
      <span class="chevron" aria-hidden="true">{{ equipCollapsed ? '▸' : '▾' }}</span>
      <span>{{ t('stash.equipped') }}</span>
      <span v-if="equipCollapsed" class="minis" aria-hidden="true">
        <i v-for="slot in EQUIP_SLOTS" :key="slot" :class="{ 'is-filled': equip[slot] }"></i>
      </span>
    </button>
    <div v-show="!equipCollapsed" class="equip-row">
      <stash-cell
        v-for="slot in EQUIP_SLOTS"
        :key="slot"
        :item="equip[slot]"
        :testid="`stash-equip-${slot}`"
      >
        <template v-if="!equip[slot]" #placeholder>
          <span class="slot" :title="slotLabel(slot)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path :d="ICON_PATHS[EQUIP_SLOT_ICON[slot]]" />
            </svg>
          </span>
        </template>
      </stash-cell>
    </div>

    <div class="carried">{{ t('stash.carried') }}</div>
    <stash-scroll-box>
      <div class="grid">
        <stash-cell
          v-for="(item, index) in bag"
          :key="index"
          :item="item"
          :testid="`stash-bag-cell-${index}`"
        />
      </div>
    </stash-scroll-box>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EQUIP_SLOTS, type TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { EQUIP_SLOT_ICON, ICON_PATHS } from '@/components/gui/icons/item-icons';
import { useStashBoardData } from '@/composables/use-stash-board-data';
import StashCell from './stash-cell.vue';
import StashScrollBox from './stash-scroll-box.vue';

const { t } = useI18n();
const { bag, equip, carried, capacity, loadRatio, isHeavy, isOver } = useStashBoardData();
const equipCollapsed = ref(false);
const loadWidth = computed(() => `${Math.round(loadRatio.value * 100)}%`);

function slotLabel(slot: TEquipSlot): string {
  return t(`itemTooltip.slot.${slot}`);
}
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  padding: 8px 10px;
  container-type: inline-size;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-family: var(--font-main, serif), serif;
  font-size: 0.95rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  color: #ffe98a;
}
.load {
  color: rgba(241, 228, 204, 0.85);
  font-size: 0.78rem;
  font-weight: 700;
}
.load.is-heavy {
  color: #e0a93f;
}
.load.is-over {
  color: #ff9d9d;
}
.loadbar {
  height: 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.loadbar i {
  display: block;
  height: 100%;
  background: #cdb98e;
  transition: width 0.2s ease;
}
.loadbar i.is-heavy {
  background: #e0a93f;
}
.loadbar i.is-over {
  background: #ff9d9d;
}
.equip-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 0;
  height: auto;
  padding: 0;
  border: none;
  background: none;
  box-shadow: none;
  color: rgba(241, 228, 204, 0.8);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.equip-toggle:hover {
  color: #ffe98a;
}
.minis {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
}
.minis i {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: rgba(120, 160, 170, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.minis i.is-filled {
  background: #cdb98e;
  border-color: #cdb98e;
}
.equip-row,
.grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
@container (max-width: 440px) {
  .equip-row,
  .grid {
    gap: 4px;
  }
}
.slot {
  display: grid;
  place-items: center;
  width: 62%;
  color: rgba(241, 228, 204, 0.32);
}
.slot svg {
  width: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.carried {
  color: rgba(241, 228, 204, 0.7);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
