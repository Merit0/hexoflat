<template>
  <Transition name="action-alert">
    <div v-if="displayMessage" class="action-alert-banner" data-testid="action-alert-banner">
      {{ displayMessage }}<span class="action-alert-mark" aria-hidden="true">!</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useHeroToolStore } from '@/stores/hero-tool-store';

const ACTION_ALERT_HIDE_MS = 3000;

const heroToolStore = useHeroToolStore();

const displayMessage = computed(() => heroToolStore.actionMessage?.replace(/\.+$/, '') ?? null);

let hideTimer: number | null = null;

watch(
  () => heroToolStore.actionMessage,
  (message) => {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!message) return;

    hideTimer = window.setTimeout(() => {
      heroToolStore.clearActionMessage();
    }, ACTION_ALERT_HIDE_MS);
  },
);

onBeforeUnmount(() => {
  if (hideTimer) window.clearTimeout(hideTimer);
});
</script>

<style scoped>
.action-alert-banner {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);

  max-width: min(420px, calc(100% - 48px));
  padding: 12px 20px;
  text-align: center;

  border-radius: 12px;
  background: rgba(20, 14, 10, 0.94);
  border: 1px solid rgba(255, 200, 130, 0.4);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);

  color: #f2e9d3;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;

  z-index: 200;
  pointer-events: none;
}

.action-alert-mark {
  margin-left: 6px;
  color: #ff4d4d;
  font-size: 1.6em;
  font-weight: 900;
  text-shadow: 0 0 8px rgba(255, 77, 77, 0.6);
  vertical-align: -0.1em;
}

.action-alert-enter-active,
.action-alert-leave-active {
  transition:
    opacity 300ms ease,
    transform 300ms ease;
}

.action-alert-enter-from,
.action-alert-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}
</style>
