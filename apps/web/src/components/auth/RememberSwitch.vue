<template>
  <button
    class="switch"
    type="button"
    role="switch"
    data-testid="auth-remember"
    :aria-checked="model"
    @click="model = !model"
  >
    <span class="switch__track" :class="{ 'switch__track--on': model }">
      <span class="switch__knob" :class="{ 'switch__knob--on': model }" />
    </span>
    {{ t('auth.remember') }}
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const model = defineModel<boolean>({ required: true });
const { t } = useI18n();
</script>

<style scoped>
.switch {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px 0 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--pow-text-2);
  font:
    500 14px Inter,
    sans-serif;
  cursor: pointer;
}
.switch:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.switch__track {
  width: 40px;
  height: 24px;
  border-radius: 12px;
  background: var(--pow-border-field);
  position: relative;
  display: block;
  transition: background 0.15s;
}
.switch__track--on {
  background: var(--pow-accent);
}
.switch__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--pow-text-strong);
  transition: left 0.15s;
}
.switch__knob--on {
  left: 19px;
}
</style>
