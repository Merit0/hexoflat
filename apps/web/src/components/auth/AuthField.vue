<template>
  <div class="field">
    <div v-if="$slots.labelExtra" class="field__row">
      <label class="field__label" :for="id">{{ label }}</label>
      <slot name="labelExtra" />
    </div>
    <label v-else class="field__label" :for="id">{{ label }}</label>
    <div class="field__box">
      <input
        :id="id"
        ref="input"
        v-model="model"
        class="field__input"
        :class="{ 'field__input--trailing': $slots.trailing }"
        :data-testid="testid"
        :type="type"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :maxlength="maxlength"
        @focus="emit('focus')"
        @blur="emit('blur')"
        @keyup="emit('keyup', $event)"
      />
      <slot name="trailing" />
    </div>
    <slot name="below" />
    <p v-if="helper" class="field__helper">{{ helper }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(
  defineProps<{
    id: string;
    label: string;
    testid: string;
    type?: string;
    placeholder?: string;
    autocomplete?: string;
    maxlength?: number;
    helper?: string;
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    autocomplete: undefined,
    maxlength: undefined,
    helper: undefined,
  },
);

const model = defineModel<string>({ required: true });
const emit = defineEmits<{ focus: []; blur: []; keyup: [event: KeyboardEvent] }>();
const input = ref<HTMLInputElement | null>(null);

defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.field__label {
  font-size: 15px;
  font-weight: 500;
  color: var(--pow-text-2);
}
.field__box {
  position: relative;
}
.field__input {
  width: 100%;
  height: 54px;
  box-sizing: border-box;
  padding: 0 14px;
  border-radius: var(--pow-radius-field);
  border: 1px solid var(--pow-border-field);
  background: var(--pow-field);
  color: var(--pow-text-strong);
  font:
    400 17px Inter,
    sans-serif;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.field__input--trailing {
  padding-right: 70px;
}
.field__input::placeholder {
  color: var(--pow-placeholder);
}
.field__input:focus {
  outline: none;
  border-color: var(--pow-accent);
  box-shadow: var(--pow-focus);
}
.field__helper {
  margin: 0;
  font-size: 14px;
  color: #8c8c93;
}
</style>
