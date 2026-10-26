<template>
  <div
    class="bar"
    :class="{ 'is-compact': compact, 'is-full': maxed }"
    :style="{ '--c': BRANCH_COLOR[node.branch] }"
    data-testid="hero-skill-progress"
  >
    <span class="medal">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path :d="ICON_PATHS[SKILL_ICON[node.id]]" />
      </svg>
    </span>
    <span class="track">
      <span class="fill" :style="{ width: `${percent}%` }"></span>
      <span
        v-if="previewExtra > 0"
        class="ghost"
        :style="{ left: `${percent}%`, width: `${previewExtra}%` }"
      ></span>
      <span class="value" data-testid="hero-skill-progress-value">{{ valueText }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import type { SkillNodeView } from '@/composables/skill-tree-view';
import { BRANCH_COLOR, SKILL_ICON } from './skill-presentation';

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
.medal {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 60%, #fff), var(--c));
  border: 3px solid color-mix(in srgb, var(--c) 70%, #1a1408);
  color: #14110a;
  box-shadow: 0 0 10px color-mix(in srgb, var(--c) 45%, transparent);
}
.medal svg {
  width: 58%;
  height: 58%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.track {
  position: relative;
  flex: 1;
  height: 24px;
  margin-left: -10px;
  padding-left: 10px;
  overflow: hidden;
  border-radius: 0 999px 999px 0;
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
.is-compact .medal {
  width: 22px;
  height: 22px;
  border-width: 2px;
}
.is-compact .track {
  height: 12px;
  margin-left: -6px;
  padding-left: 6px;
}
.is-compact .value {
  display: none;
}
</style>
