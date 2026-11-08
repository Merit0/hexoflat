<template>
  <div
    class="splitter"
    :class="{ 'is-dragging': dragging }"
    role="separator"
    aria-orientation="horizontal"
    tabindex="0"
    :aria-label="t('stash.resize')"
    :aria-valuemin="MIN_PERCENT"
    :aria-valuemax="MAX_PERCENT"
    :aria-valuenow="percent"
    data-testid="stash-splitter"
    @pointerdown.prevent="startDrag"
    @dblclick="emit('update:ratio', DEFAULT_RATIO)"
    @keydown.up.prevent="nudge(-KEY_STEP)"
    @keydown.down.prevent="nudge(KEY_STEP)"
  >
    <span class="line" aria-hidden="true"></span>
    <span class="pill">
      <i aria-hidden="true"></i>
      <b>{{ t('stash.resize') }}</b>
      <i aria-hidden="true"></i>
    </span>
    <span class="line" aria-hidden="true"></span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { clampStashRatio, STASH_SPLIT } from '@/composables/stash-split';

const { MIN_RATIO, MAX_RATIO, DEFAULT_RATIO, KEY_STEP } = STASH_SPLIT;
const MIN_PERCENT = Math.round(MIN_RATIO * 100);
const MAX_PERCENT = Math.round(MAX_RATIO * 100);

const props = defineProps<{ ratio: number }>();
const emit = defineEmits<{ 'update:ratio': [ratio: number] }>();

const { t } = useI18n();
const dragging = ref(false);
const percent = computed(() => Math.round(props.ratio * 100));
let stopDrag: (() => void) | null = null;

function nudge(delta: number) {
  emit('update:ratio', clampStashRatio(props.ratio + delta));
}

function startDrag(event: PointerEvent) {
  const handle = event.currentTarget as HTMLElement;
  const area = handle.parentElement;
  if (!area) return;
  dragging.value = true;

  const onMove = (move: PointerEvent) => {
    const rect = area.getBoundingClientRect();
    const free = rect.height - handle.offsetHeight;
    if (free <= 0) return;
    emit(
      'update:ratio',
      clampStashRatio((move.clientY - rect.top - handle.offsetHeight / 2) / free),
    );
  };
  const onUp = () => stopDrag?.();

  stopDrag = () => {
    dragging.value = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    stopDrag = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

onBeforeUnmount(() => stopDrag?.());
</script>

<style scoped>
.splitter {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: row-resize;
  touch-action: none;
  outline: none;
}
.line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(122, 141, 160, 0.45));
}
.line:last-child {
  background: linear-gradient(90deg, rgba(122, 141, 160, 0.45), transparent);
}
.pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(122, 141, 160, 0.45);
  color: rgba(241, 228, 204, 0.7);
  font-family: var(--font-main, serif), serif;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition:
    border-color 0.12s ease,
    color 0.12s ease;
}
.pill i {
  width: 10px;
  height: 2px;
  border-radius: 1px;
  background: currentColor;
  opacity: 0.7;
}
.pill b {
  font-weight: 700;
}
.splitter:hover .pill,
.splitter:focus-visible .pill,
.splitter.is-dragging .pill {
  border-color: #ffe98a;
  color: #ffe98a;
}
</style>
