<template>
  <div class="success pow-rise" data-testid="auth-success">
    <svg
      class="success__icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7FB8E6"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" />
      <path d="M8 12.2l2.7 2.6L16.2 9.4" />
    </svg>
    <h1 class="success__title">{{ t('auth.success.title', { name }) }}</h1>
    <p class="success__text">{{ t('auth.success.loading') }}</p>
    <div class="success__track">
      <div class="success__fill pow-bar" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ name: string }>();
const { t } = useI18n();
</script>

<style scoped>
.success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  padding: 24px 0;
}
.success__icon {
  width: 64px;
  height: 64px;
}
.success__title {
  margin: 0;
  font-family: Cinzel, serif;
  font-size: 28px;
  font-weight: 600;
  color: var(--pow-text-strong);
}
.success__text {
  margin: 0;
  color: var(--pow-text-3);
  font-size: 15px;
}
.success__track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #222b37;
  overflow: hidden;
}
.success__fill {
  height: 6px;
  border-radius: 3px;
  background: var(--pow-accent);
}
</style>
