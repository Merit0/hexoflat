<template>
  <div class="tree" :style="{ '--cols': view.skills.length }" data-testid="hero-skill-tree">
    <div class="root" data-testid="hero-skill-tree-root">
      <img class="root__icon" :src="WILL_ICON_URL" alt="" data-testid="hero-skill-tree-will-icon" />
      <div class="root__value" data-testid="hero-skill-tree-will">
        <b>{{ view.will?.current ?? 0 }}</b
        ><small> /{{ view.will?.capacity ?? 0 }}</small>
      </div>
    </div>

    <div class="fork" data-testid="hero-skill-tree-fork"></div>

    <div class="branches" data-testid="hero-skill-tree-branches">
      <section
        v-for="skill in view.skills"
        :key="skill.id"
        class="branch"
        :data-testid="`hero-skill-${skill.id}`"
      >
        <div class="branch__head">
          <span class="branch__title" :data-testid="`hero-skill-${skill.id}-title`">{{
            labels.skill.title[skill.id]
          }}</span>
          <span class="branch__rank" :data-testid="`hero-skill-${skill.id}-rank`">
            {{ labels.skill.rank }} <b>{{ skill.rank }}</b
            ><small> /{{ skill.maxRank }}</small>
          </span>
          <span class="branch__bonus" :data-testid="`hero-skill-${skill.id}-bonus`">
            <b>+{{ skill.bonus }}</b> {{ labels.skill.bonus[skill.id] }}
          </span>
        </div>

        <div
          class="chain"
          :style="{ '--filled': Math.max(skill.rank - 1, 0) }"
          :data-testid="`hero-skill-${skill.id}-nodes`"
        >
          <span class="chain__track"></span>
          <span class="chain__fill"></span>
          <div v-for="n in skill.maxRank" :key="n" class="slot">
            <button
              v-if="n === skill.rank + 1"
              class="node node--next"
              :class="`is-${skill.status}`"
              type="button"
              :disabled="skill.status !== 'ready'"
              :title="statusNote(skill)"
              :data-testid="`hero-skill-${skill.id}-unlock`"
              @click="emit('unlock', skill.id)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="ICON_PATHS[ICON_BY_SKILL[skill.id]]" />
              </svg>
              <span class="badge" :data-testid="`hero-skill-${skill.id}-badge-${n}`">{{ n }}</span>
            </button>
            <span
              v-else
              class="node"
              :class="{ 'is-unlocked': n <= skill.rank }"
              :data-testid="`hero-skill-${skill.id}-node-${n}`"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="ICON_PATHS[ICON_BY_SKILL[skill.id]]" />
              </svg>
              <span class="badge" :data-testid="`hero-skill-${skill.id}-badge-${n}`">{{ n }}</span>
            </span>
            <span
              v-if="n === skill.rank + 1"
              class="cost"
              :class="`is-${skill.status}`"
              :data-testid="`hero-skill-${skill.id}-cost`"
            >
              {{ skill.nextCost }} {{ labels.skill.will }}
            </span>
          </div>
        </div>

        <div v-if="skill.status === 'max'" class="branch__max">{{ labels.skill.max }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { ICON_PATHS, type TIconName } from '@/components/gui/icons/item-icons';
import {
  WILL_ICON_URL,
  type HeroDetailsView,
  type SkillView,
} from '@/composables/use-hero-details';
import { useHeroDetailsLabels } from './use-hero-details-labels';

defineProps<{ view: HeroDetailsView }>();
const emit = defineEmits<{ unlock: [SkillId] }>();
const labels = useHeroDetailsLabels();

const ICON_BY_SKILL: Record<SkillId, TIconName> = { attack: 'sword', defense: 'shield' };

function statusNote(skill: SkillView): string {
  if (skill.status === 'need-will') return labels.value.skill.needWill;
  if (skill.status === 'locked') return labels.value.skill.locked;
  return labels.value.skill.unlock;
}
</script>

<style scoped>
.tree {
  --node: 36px;
  --gap: 10px;
  display: grid;
  justify-items: center;
}
.root {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 10px 22px;
  border-radius: 18px;
  background: #0f1113;
  border: 1px solid #3a474e;
}
.root__icon {
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.root__value {
  color: #cbbfa6;
  font-size: 0.85rem;
}
.root__value b {
  color: #e8d7a8;
  font-size: 1.4rem;
  font-weight: 800;
}
.fork {
  position: relative;
  width: 100%;
  height: 28px;
}
.fork::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 14px;
  margin-left: -1px;
  background: #3a474e;
}
.fork::after {
  content: '';
  position: absolute;
  top: 14px;
  left: calc(100% / (2 * var(--cols)));
  right: calc(100% / (2 * var(--cols)));
  height: 2px;
  background: #3a474e;
}
.branches {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: 10px;
}
.branch {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 10px;
  padding: 10px 8px 14px;
  border-radius: 16px;
  background: #0f1113;
  border: 1px solid #23292c;
}
.branch::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: 2px;
  height: 14px;
  margin-left: -1px;
  background: #3a474e;
}
.branch__head {
  display: grid;
  justify-items: center;
  gap: 2px;
  text-align: center;
}
.branch__title {
  color: #e8d7a8;
  font-family: 'Alegreya SC', serif;
  font-size: 1.1rem;
  font-weight: 700;
}
.branch__rank {
  color: #cbbfa6;
  font-size: 0.8rem;
}
.branch__rank b {
  color: #ede3d2;
  font-size: 1.1rem;
  font-weight: 800;
}
.branch__bonus {
  color: #a39886;
  font-size: 0.8rem;
}
.branch__bonus b {
  color: #e8d7a8;
}
.branch__max {
  color: #a39886;
  font-style: italic;
  font-size: 0.85rem;
}
.chain {
  position: relative;
  display: grid;
  row-gap: var(--gap);
  justify-items: center;
}
.chain__track,
.chain__fill {
  position: absolute;
  top: calc(var(--node) / 2);
  left: 50%;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
}
.chain__track {
  bottom: calc(var(--node) / 2);
  background: #23292c;
}
.chain__fill {
  height: calc((var(--node) + var(--gap)) * var(--filled));
  background: linear-gradient(180deg, #5a0f2c, #8c1c47);
}
.slot {
  position: relative;
  display: grid;
  place-items: center;
  height: var(--node);
}
.node {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--node);
  height: var(--node);
  padding: 0;
  border-radius: 50%;
  background: #14181c;
  border: 2px solid #3a474e;
  color: #4a5a63;
}
.node svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.node.is-unlocked {
  background: #5a0f2c;
  border-color: #c9345f;
  color: #ede3d2;
  box-shadow: 0 0 8px rgba(201, 52, 95, 0.5);
}
.node--next {
  cursor: pointer;
}
.node--next.is-ready {
  border-color: #e8d7a8;
  color: #e8d7a8;
  box-shadow: 0 0 10px rgba(232, 215, 168, 0.45);
}
.node--next:disabled {
  cursor: not-allowed;
}
.node--next.is-need-will,
.node--next.is-locked {
  color: #7a6f60;
  border-style: dashed;
}
.badge {
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 999px;
  background: #0f1113;
  border: 1px solid #3a474e;
  color: #a39886;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
}
.node.is-unlocked .badge {
  background: #c9345f;
  border-color: #ffb8c8;
  color: #fff;
}
.node--next.is-ready .badge {
  background: #e8d7a8;
  border-color: #e8d7a8;
  color: #1a1408;
}
.cost {
  position: absolute;
  left: calc(50% + var(--node) / 2 + 10px);
  color: #a39886;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.cost.is-ready {
  color: #e8d7a8;
}
</style>
