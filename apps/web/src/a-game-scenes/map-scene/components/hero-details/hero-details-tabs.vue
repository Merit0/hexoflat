<template>
  <div class="switch" role="group" data-testid="hero-details-tabs">
    <button
      v-for="tab in TABS"
      :key="tab"
      class="btn"
      :class="{ 'is-active': modelValue === tab }"
      type="button"
      :aria-pressed="modelValue === tab"
      :data-testid="`hero-details-tab-${tab}`"
      @click="emit('update:modelValue', tab)"
    >
      {{ tab === 'state' ? t('heroDetails.tab.state') : t('heroDetails.tab.path') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { HeroDetailsTab } from '@/composables/use-hero-details';

defineProps<{ modelValue: HeroDetailsTab }>();
const emit = defineEmits<{ 'update:modelValue': [HeroDetailsTab] }>();

const TABS: HeroDetailsTab[] = ['state', 'path'];
const { t } = useI18n();
</script>

<style scoped>
.switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.btn {
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid #3a1422;
  background: #2a0e18;
  color: #cbbfa6;
  font-family: 'Alegreya SC', serif;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.btn.is-active {
  background: linear-gradient(180deg, #8c1c47, #5a0f2c);
  border-color: #8c1c47;
  color: #ede3d2;
}
</style>
