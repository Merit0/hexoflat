<template>
  <span class="tip-host" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <slot />
    <teleport to="body">
      <span
        v-if="open && text"
        class="tip"
        role="tooltip"
        :style="{ left: `${left}px`, top: `${top}px` }"
        :data-testid="testid"
      >
        <b v-if="title">{{ title }}</b>
        <span>{{ text }}</span>
      </span>
    </teleport>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const WIDTH = 250;
const GAP = 8;
const MARGIN = 8;

withDefaults(defineProps<{ text?: string | null; title?: string; testid?: string }>(), {
  text: null,
  title: undefined,
  testid: undefined,
});

const open = ref(false);
const left = ref(0);
const top = ref(0);

function show(event: Event) {
  const host = event.currentTarget as HTMLElement;
  const rect = host.getBoundingClientRect();
  left.value = Math.max(MARGIN, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - MARGIN));
  top.value = rect.bottom + GAP;
  open.value = true;
}

function hide() {
  open.value = false;
}
</script>

<style scoped>
.tip-host {
  display: inline-flex;
}
.tip {
  position: fixed;
  z-index: 70;
  display: grid;
  gap: 4px;
  box-sizing: border-box;
  width: 250px;
  padding: 10px 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: left;
  color: rgba(241, 228, 204, 0.95);
  pointer-events: none;
  background: rgba(14, 11, 9, 0.97);
  border: 1px solid rgba(122, 141, 160, 0.7);
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.65);
}
.tip b {
  color: #ffe98a;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 8px rgba(255, 233, 138, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.8);
}
</style>
