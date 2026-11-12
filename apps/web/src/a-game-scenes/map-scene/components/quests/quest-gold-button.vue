<template>
  <span class="shape" :class="[`v-${variant}`, { 'is-disabled': disabled }]">
    <button
      v-if="variant !== 'counter'"
      type="button"
      class="face"
      :disabled="disabled"
      :data-testid="testid"
      v-bind="$attrs"
    >
      <slot />
    </button>
    <span v-else class="face" :data-testid="testid" v-bind="$attrs"><slot /></span>
  </span>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    testid: string;
    variant?: 'gold' | 'claim' | 'counter' | 'main';
    disabled?: boolean;
  }>(),
  { variant: 'gold', disabled: false },
);
</script>

<style scoped>
.shape {
  display: inline-block;
  width: 104px;
  height: 40px;
}
.shape.v-main {
  width: auto;
  min-width: 132px;
  height: 42px;
}
.shape:focus-within {
  filter: drop-shadow(0 0 2px #ffe7a8) drop-shadow(0 0 6px #c9a04e);
}
.face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  height: 100%;
  padding: 0 14px;
  font-family: var(--q-display);
  font-size: 19px;
  font-weight: 700;
  line-height: 1;
  color: #2a1e0a;
  background: linear-gradient(180deg, #f6dc93, #d9ae55 48%, #b5863a);
  border: 0;
  clip-path: polygon(
    11px 0,
    calc(100% - 11px) 0,
    100% 50%,
    calc(100% - 11px) 100%,
    11px 100%,
    0 50%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.v-main .face {
  font-size: 21px;
}
.v-claim .face {
  background: linear-gradient(180deg, #ffe7a3, #e8bc5e, #c08f3c);
}
.v-counter .face {
  color: #e9c77b;
  background: #15181b;
  box-shadow: inset 0 0 0 1px #4a5057;
  cursor: default;
}
.is-disabled .face {
  color: #a3a8ae;
  background: linear-gradient(180deg, #4a4f55, #33373c);
  box-shadow: none;
  cursor: not-allowed;
}
</style>
