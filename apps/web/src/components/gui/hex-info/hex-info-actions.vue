<template>
  <footer v-if="actions.length" class="actions" :class="{ 'is-prominent': prominent }">
    <span class="actions__title">{{ t('hexInfo.actions') }}</span>
    <ul class="actions__list">
      <li v-for="action in actions" :key="action.id" class="actions__item">
        <span class="actions__name">{{ action.label }}</span>
        <span
          class="actions__cost"
          :class="{ 'is-free': action.will === 0 }"
          data-testid="hex-info-action-cost"
        >
          {{ action.will === 0 ? t('hexInfo.free') : t('hexInfo.will', { n: action.will }) }}
        </span>
      </li>
    </ul>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { HexInfoAction } from '@/services/hex-info/build-hex-info';

defineProps<{ actions: HexInfoAction[]; prominent?: boolean }>();
const { t } = useI18n();
</script>

<style scoped>
.actions {
  display: grid;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid rgba(185, 138, 67, 0.45);
}
.actions__title {
  color: var(--muted);
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.actions__list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.actions__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 0.82rem;
}
.actions__cost {
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 800;
}
.actions__cost.is-free {
  border-color: #3a3226;
  color: var(--muted);
  font-weight: 600;
}
.is-prominent .actions__item {
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, #0e0c09);
  font-size: 1rem;
  font-weight: 700;
}
</style>
