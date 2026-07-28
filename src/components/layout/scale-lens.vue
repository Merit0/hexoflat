<template>
  <div ref="hostRef" class="lens-host">
    <div ref="stageRef" class="lens-stage" :style="stageStyle">
      <div ref="contentRef" class="lens-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    padding?: number; // внутрішній padding “лінзи” (px)
    maxScale?: number; // верхня межа
    minScale?: number; // нижня межа
    mode?: 'contain' | 'cover'; // contain = влізти, cover = заповнити
  }>(),
  {
    padding: 0,
    maxScale: 1,
    minScale: 0.1,
    mode: 'contain',
  },
);

const hostRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);

const scale = ref(1);

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function measureAndScale() {
  const host = hostRef.value;
  const content = contentRef.value;
  if (!host || !content) return;

  const hostRect = host.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();

  const availW = Math.max(0, hostRect.width - props.padding * 2);
  const availH = Math.max(0, hostRect.height - props.padding * 2);

  // ВАЖЛИВО: contentRect вже враховує поточний scale, але ми міряємо в "нативі"
  // Тому беремо scrollWidth/scrollHeight (нативний layout) як базу.
  const baseW = Math.max(content.scrollWidth, 1);
  const baseH = Math.max(content.scrollHeight, 1);

  const sx = availW / baseW;
  const sy = availH / baseH;

  const raw = props.mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  scale.value = clamp(raw, props.minScale, props.maxScale);
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  measureAndScale();

  ro = new ResizeObserver(() => measureAndScale());
  if (hostRef.value) ro.observe(hostRef.value);
  if (contentRef.value) ro.observe(contentRef.value);

  // на всяк випадок: наступний кадр (коли шрифти/картинки підтягнуться)
  requestAnimationFrame(measureAndScale);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
});

watchEffect(() => {
  // якщо пропси зміняться
  void props.padding;
  void props.maxScale;
  void props.minScale;
  void props.mode;
  // легкий reflow
  queueMicrotask(measureAndScale);
});

const stageStyle = computed(() => ({
  transform: `scale(${scale.value})`,
}));
</script>

<style scoped>
.lens-host {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
}

/* stage is what scales */
.lens-stage {
  transform-origin: center center;
  will-change: transform;
}

/* content is kept in its native fixed size */
.lens-content {
  width: max-content;
  height: max-content;
}
</style>
