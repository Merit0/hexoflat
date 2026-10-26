<template>
  <button
    class="node"
    :class="[
      `node--${size}`,
      `is-${node.status}`,
      { 'is-open': node.rank >= 1, 'is-selected': selected },
    ]"
    :style="{ '--c': BRANCH_COLOR[node.branch] }"
    type="button"
    :aria-pressed="selected"
    :data-testid="`hero-skill-node-${node.id}`"
    @click="emit('select', node.id)"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path :d="ICON_PATHS[SKILL_ICON[node.id]]" />
    </svg>
    <span class="rank" :data-testid="`hero-skill-node-${node.id}-rank`">{{ node.rank }}</span>
    <skill-progress-bar
      v-if="node.progress > 0"
      class="mini"
      compact
      :node="node"
      :data-testid="`hero-skill-node-${node.id}-progress`"
    />
    <span v-if="isNew" class="new">{{ t('heroDetails.tree.ui.new') }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import type { SkillNodeView } from '@/composables/skill-tree-view';
import SkillProgressBar from './skill-progress-bar.vue';
import { BRANCH_COLOR, SKILL_ICON } from './skill-presentation';

const props = defineProps<{
  node: SkillNodeView;
  selected: boolean;
  size: 'crest' | 'node' | 'cap';
}>();
const emit = defineEmits<{ select: [SkillId] }>();
const { t } = useI18n();
const isNew = computed(() => props.node.id === 'a_teleport' && props.node.rank === 0);
</script>

<style scoped>
.node {
  --size: 56px;
  --radius: 14px;
  position: relative;
  display: grid;
  place-items: center;
  width: var(--size);
  height: var(--size);
  padding: 0;
  border-radius: var(--radius);
  background: #121518;
  border: 2px solid #2a3236;
  color: #56636a;
  opacity: 0.6;
  cursor: pointer;
}
.node--crest {
  --size: 62px;
  --radius: 18px;
}
.node--cap {
  --size: 58px;
}
.node svg {
  width: 55%;
  height: 55%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.node.is-ready,
.node.is-need-will,
.node.is-locked.is-open,
.node.is-open {
  opacity: 1;
}
.node.is-ready {
  border-color: color-mix(in srgb, var(--c) 60%, transparent);
  color: var(--c);
}
.node.is-need-will {
  border-color: color-mix(in srgb, var(--c) 40%, transparent);
  border-style: dashed;
  color: #8a8f8c;
}
.node.is-open {
  background: color-mix(in srgb, var(--c) 22%, #121518);
  border: 2px solid var(--c);
  color: #f6eedc;
  box-shadow: 0 0 10px color-mix(in srgb, var(--c) 40%, transparent);
}
.node.is-selected {
  opacity: 1;
  box-shadow:
    0 0 0 3px #121416,
    0 0 0 5px #f3ead8;
}
.mini {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 3px;
  width: auto;
}
.rank {
  position: absolute;
  right: -6px;
  bottom: -6px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #0f1113;
  border: 1px solid #3a474e;
  color: #a39886;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}
.is-open .rank {
  background: var(--c);
  border-color: #f6eedc;
  color: #1a1408;
}
.new {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--c);
  color: #0f1113;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
</style>
