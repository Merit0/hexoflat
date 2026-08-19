<template>
  <div
    class="overlay-root"
    data-testid="overlay-root"
    :class="{ 'overlay-root--active': overlay.stack.length > 0 }"
  >
    <template v-for="(entry, i) in overlay.stack" :key="entry.name + i">
      <component
        :is="registry[entry.name]"
        v-if="registry[entry.name]"
        :ref="(el: Element | ComponentPublicInstance | null) => setOverlayRef(i, el)"
        :data="entry.data"
        :data-testid="`overlay-${entry.name}`"
        :style="{ zIndex: 2000 + i }"
        @close="overlay.closeOverlay(entry.name)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch, type Component } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useOverlayStore } from '@/stores/overlay-store';
import type { OverlayType } from '@/types/overlay-types';
import HexTileDetailsOverlay from '@/components/overlays/hex-tile-details-overlay.vue';
import SettingsOverlay from '@/components/overlays/settings-overlay.vue';

const overlay = useOverlayStore();

const registry: Partial<Record<OverlayType, Component>> = {
  'hex-tile-details': HexTileDetailsOverlay,
  settings: SettingsOverlay,
};

const overlayEls = new Map<number, HTMLElement>();

function setOverlayRef(index: number, instance: Element | ComponentPublicInstance | null) {
  if (!instance) {
    overlayEls.delete(index);
    return;
  }
  const el: unknown = instance instanceof Element ? instance : instance.$el;
  if (el instanceof HTMLElement) overlayEls.set(index, el);
}

function topOverlayEl(): HTMLElement | null {
  const topIndex = overlay.stack.length - 1;
  return topIndex >= 0 ? (overlayEls.get(topIndex) ?? null) : null;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

let previouslyFocused: HTMLElement | null = null;

watch(
  () => overlay.stack.length,
  (length, prevLength) => {
    if (length > 0 && prevLength === 0) {
      previouslyFocused = document.activeElement as HTMLElement | null;
    }

    if (length > 0) {
      void nextTick(() => topOverlayEl()?.focus());
    } else {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
);

function trapTab(event: KeyboardEvent) {
  const root = topOverlayEl();
  if (!root) return;

  const focusable = focusableElements(root);
  if (focusable.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const activeIsInside = active instanceof Node && root.contains(active);

  if (event.shiftKey) {
    if (!activeIsInside || active === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (!activeIsInside || active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (!overlay.stack.length) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    overlay.closeTop();
    return;
  }

  // ✅ Keeps Tab focus cycling inside the topmost overlay instead of leaking
  // out to the page behind it, per standard modal-dialog focus-trap behavior.
  if (event.key === 'Tab') {
    trapTab(event);
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.overlay-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: none;
}

.overlay-root--active {
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  pointer-events: auto;
}

.overlay-root > * {
  animation: fadeIn 0.25s ease both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
