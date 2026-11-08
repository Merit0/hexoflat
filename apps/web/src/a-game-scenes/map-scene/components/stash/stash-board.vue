<template>
  <section class="stash-board" data-testid="stash-board" :aria-label="t('stash.title')">
    <header class="top">
      <img class="emblem" :src="CHEST_IMAGE" alt="" aria-hidden="true" />
      <h2>{{ t('stash.title') }}</h2>
      <button
        type="button"
        class="close-btn"
        data-testid="stash-close"
        :aria-label="t('stash.close')"
        @click="closeStashBoard()"
      >
        ×
      </button>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>

    <div class="split" :style="splitStyle">
      <stash-bag-pane />
      <stash-splitter :ratio="ratio" @update:ratio="settings.setStashSplitRatio($event)" />
      <stash-chest-pane />
    </div>

    <p class="foot">{{ t('stash.hint') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { closeStashBoard } from '@/composables/use-stash-board';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import StashBagPane from './stash-bag-pane.vue';
import StashChestPane from './stash-chest-pane.vue';
import StashSplitter from './stash-splitter.vue';

const CHEST_IMAGE = '/hex-assets/hex-loot/stash-chest-token-image.png';

const { t } = useI18n();
const settings = useUiSettingsStore();
const ratio = computed(() => settings.stashSplitRatio);
const splitStyle = computed(() => ({
  gridTemplateRows: `minmax(0, ${ratio.value}fr) 22px minmax(0, ${1 - ratio.value}fr)`,
}));
</script>

<style scoped>
.stash-board {
  --copper: #7a8da0;
  --copper-dim: #3a4a58;
  --parchment: #f1e4cc;
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  margin-top: 8px;
  padding: 10px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--parchment);
  font-family: var(--font-main, serif), serif;
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(122, 141, 160, 0.1), transparent 60%),
    linear-gradient(180deg, #1b1714, #0f0d0b);
  border: 2px solid var(--copper-dim);
  border-radius: 10px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.8),
    inset 0 0 0 3px #0d0b09,
    inset 0 0 0 4px rgba(122, 141, 160, 0.45),
    0 14px 30px rgba(0, 0, 0, 0.6);
}
.top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  padding-right: 44px;
}
.emblem {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.7));
  pointer-events: none;
}
h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-align: center;
  color: #ffe98a;
  text-shadow:
    0 0 12px rgba(255, 233, 138, 0.4),
    0 2px 3px rgba(0, 0, 0, 0.8);
}
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}
.ornament {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ornament span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--copper-dim), transparent);
}
.ornament i {
  width: 9px;
  height: 9px;
  border: 1px solid var(--copper);
  transform: rotate(45deg);
}
.split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.foot {
  margin: 0;
  color: rgba(241, 228, 204, 0.6);
  font-size: 0.72rem;
  text-align: center;
}
</style>
