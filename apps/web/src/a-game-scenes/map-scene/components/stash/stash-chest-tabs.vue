<template>
  <div class="tabs" role="tablist" :aria-label="t('stash.chests')">
    <button
      v-for="chest in STASH_MAX_CHESTS"
      :key="chest"
      type="button"
      role="tab"
      class="tab"
      :class="{
        'is-active': stash.activeChest === chest - 1,
        'is-locked': chest - 1 >= stash.chests,
      }"
      :aria-selected="stash.activeChest === chest - 1"
      :data-testid="`stash-tab-${chest}`"
      :data-state="chest - 1 < stash.chests ? 'owned' : 'locked'"
      @click="stash.selectChest(chest - 1)"
    >
      <svg v-if="chest - 1 >= stash.chests" class="lock" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <span>{{ t('stash.chest', { n: chest }) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { STASH_MAX_CHESTS } from '@hexoflat/engine/inventory/stash-constants';
import { useHeroStashStore } from '@/stores/hero-stash-store';

const { t } = useI18n();
const stash = useHeroStashStore();
</script>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 3px;
}
.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 0;
  height: 30px;
  padding: 0 2px;
  overflow: hidden;
  border-radius: 5px 5px 0 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: none;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(9px, 1.9cqw, 12px);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.tab span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab:hover {
  background: rgba(138, 173, 180, 0.2);
}
.tab.is-locked {
  color: rgba(255, 255, 255, 0.45);
}
.tab.is-active {
  background: rgba(120, 160, 170, 0.26);
  border-color: rgba(255, 220, 150, 0.55);
  color: rgba(255, 236, 186, 0.95);
}
.lock {
  flex: none;
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
