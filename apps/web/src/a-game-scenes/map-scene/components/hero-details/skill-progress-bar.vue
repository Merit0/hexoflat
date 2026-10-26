<template>
  <div
    class="bar"
    :class="{ 'is-compact': compact, 'is-full': maxed }"
    :style="{ '--c': BRANCH_COLOR[node.branch] }"
    data-testid="hero-skill-progress"
  >
    <span class="track">
      <span class="fill" :style="{ width: `${percent}%` }"></span>
      <span
        v-if="previewExtra > 0"
        class="ghost"
        :style="{ left: `${percent}%`, width: `${previewExtra}%` }"
      ></span>
      <span v-if="!compact" class="value" data-testid="hero-skill-progress-value">{{
        valueText
      }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SkillNodeView } from '@/composables/skill-tree-view';
import { BRANCH_COLOR } from './skill-presentation';

const props = defineProps<{
  node: SkillNodeView;
  previewAmount?: number;
  compact?: boolean;
}>();

const maxed = computed(() => props.node.nextCost === null);
const cost = computed(() => props.node.nextCost ?? 0);
const percent = computed(() =>
  maxed.value ? 100 : Math.min(100, Math.round((props.node.progress / cost.value) * 100)),
);
const previewExtra = computed(() => {
  if (maxed.value || !props.previewAmount) return 0;
  const reach = Math.min(
    100,
    Math.round(((props.node.progress + props.previewAmount) / cost.value) * 100),
  );
  return Math.max(0, reach - percent.value);
});
const valueText = computed(() => (maxed.value ? 'MAX' : `${props.node.progress}/${cost.value}`));
</script>

<style scoped>
.bar {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.track {
  position: relative;
  flex: 1;
  height: 24px;
  overflow: hidden;
  border-radius: 999px;
  background: #0b0d0e;
  border: 2px solid color-mix(in srgb, var(--c) 55%, #1a1408);
}
.fill,
.ghost {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--c) 100%, transparent) 0 8px,
    color-mix(in srgb, var(--c) 78%, #fff) 8px 16px
  );
  transition: width 0.4s ease;
}
.ghost {
  opacity: 0.4;
}
.value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #f6eedc;
  font-size: 0.75rem;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.is-compact .track {
  height: 10px;
}
.is-compact .value {
  display: none;
}
</style>
