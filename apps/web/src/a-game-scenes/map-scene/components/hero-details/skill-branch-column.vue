<template>
  <section
    class="branch"
    :class="{ 'is-active': active }"
    :style="{ '--c': BRANCH_COLOR[branch.id] }"
    :data-testid="`hero-skill-branch-${branch.id}`"
  >
    <skill-node
      :node="branch.crest"
      :selected="selectedId === branch.crest.id"
      size="crest"
      @select="emit('select', $event)"
    />
    <div class="head">
      <span class="head__name">{{ branchName(branch.id) }}</span>
      <span class="head__tag">{{ branchTag(branch.id) }}</span>
    </div>
    <div class="fork" :class="{ 'is-lit': branch.forkLit }"></div>
    <div v-for="(row, i) in branch.rows" :key="i" class="row">
      <div v-for="node in row" :key="node.id" class="cell" :class="{ 'is-lit': node.parentLit }">
        <skill-node
          :node="node"
          :selected="selectedId === node.id"
          size="node"
          @select="emit('select', $event)"
        />
      </div>
    </div>
    <div class="fork fork--cap" :class="{ 'is-lit': branch.capLit }"></div>
    <skill-node
      :node="branch.cap"
      :selected="selectedId === branch.cap.id"
      size="cap"
      @select="emit('select', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import type { BranchView } from '@/composables/skill-tree-view';
import SkillNode from './skill-node.vue';
import { BRANCH_COLOR } from '@/components/gui/icons/skill-presentation';
import { useSkillTexts } from './use-skill-texts';

defineProps<{ branch: BranchView; selectedId: SkillId; active: boolean }>();
const emit = defineEmits<{ select: [SkillId] }>();
const { branchName, branchTag } = useSkillTexts();
</script>

<style scoped>
.branch {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 8px;
  padding: 12px 6px 14px;
  border-radius: 16px;
  background: #0f1113;
  border: 1px solid #23292c;
}
.branch.is-active {
  background: #15191c;
  border-color: color-mix(in srgb, var(--c) 40%, transparent);
}
.head {
  display: grid;
  justify-items: center;
  text-align: center;
}
.head__name {
  color: var(--c);
  font-family: 'Alegreya SC', serif;
  font-size: 1rem;
  font-weight: 700;
}
.head__tag {
  color: #a39886;
  font-size: 0.72rem;
}
.fork,
.cell::before {
  background: #2a3236;
}
.fork {
  position: relative;
  width: 60%;
  height: 2px;
  margin: 4px 0 10px;
}
.fork.is-lit,
.cell.is-lit::before {
  background: var(--c);
}
.fork::before,
.fork::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 10px;
  background: inherit;
}
.fork::before {
  left: 0;
  top: 0;
}
.fork::after {
  right: 0;
  top: 0;
}
.fork--cap {
  margin: 0 0 4px;
}
.fork--cap::before,
.fork--cap::after {
  top: -10px;
}
.row {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 12px;
}
.cell {
  position: relative;
  display: grid;
  justify-items: center;
}
.cell::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: 2px;
  height: 8px;
  margin-left: -1px;
}
</style>
