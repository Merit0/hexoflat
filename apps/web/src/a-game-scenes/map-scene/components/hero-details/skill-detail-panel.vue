<template>
  <section
    class="detail"
    :style="{ '--c': BRANCH_COLOR[node.branch] }"
    data-testid="hero-skill-detail"
  >
    <span class="icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path :d="ICON_PATHS[SKILL_ICON[node.id]]" />
      </svg>
    </span>
    <div class="body">
      <div class="title">
        <b data-testid="hero-skill-detail-name">{{ name(node.id) }}</b>
        <span data-testid="hero-skill-detail-rank">
          {{ t('heroDetails.tree.ui.level') }} {{ node.rank }}/{{ node.maxRank }}
        </span>
      </div>
      <div class="school">{{ branchName(node.branch) }}</div>
      <p class="fx" data-testid="hero-skill-detail-current">
        {{ node.rank >= 1 ? effectText(node.id, node.rank) : t('heroDetails.tree.ui.notOpened') }}
      </p>
      <p class="fx fx--next" data-testid="hero-skill-detail-next">
        <template v-if="node.nextCost === null">{{ t('heroDetails.tree.ui.maxed') }}</template>
        <template v-else>
          <em>{{ t('heroDetails.tree.ui.next') }}:</em> {{ effectText(node.id, node.rank + 1) }}
        </template>
      </p>
      <p v-if="node.status === 'requires'" class="req" data-testid="hero-skill-detail-requires">
        {{ t('heroDetails.tree.ui.requires', { list: requiredNames }) }}
      </p>
      <div class="foot">
        <span class="cost" data-testid="hero-skill-detail-cost">
          <template v-if="node.status === 'soon'">{{ t('heroDetails.tree.ui.soon') }}</template>
          <template v-else-if="node.nextCost !== null">
            <img :src="WILL_ICON_URL" alt="" />
            {{ t('heroDetails.tree.ui.cost', { cost: node.nextCost, will }) }}
          </template>
        </span>
        <button
          class="action"
          type="button"
          :disabled="node.status !== 'ready'"
          data-testid="hero-skill-detail-action"
          @click="emit('unlock', node.id)"
        >
          {{ actionLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SKILLS, type SkillId } from '@hexoflat/engine/skills/skill-content';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import type { SkillNodeView } from '@/composables/skill-tree-view';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import { BRANCH_COLOR, SKILL_ICON } from './skill-presentation';
import { useSkillTexts } from './use-skill-texts';

const props = defineProps<{ node: SkillNodeView; will: number }>();
const emit = defineEmits<{ unlock: [SkillId] }>();
const { t, name, branchName, effectText } = useSkillTexts();

const requiredNames = computed(() =>
  SKILLS[props.node.id].requires.map((id) => name(id)).join(', '),
);

const actionLabel = computed(() => {
  const { status, rank, id } = props.node;
  if (status === 'max') return t('heroDetails.tree.ui.action.max');
  if (status === 'soon') return t('heroDetails.tree.ui.action.soon');
  if (status === 'requires' || status === 'locked') return t('heroDetails.tree.ui.action.locked');
  if (status === 'need-will') return t('heroDetails.tree.ui.action.needWill');
  if (rank > 0) return t('heroDetails.tree.ui.action.upgrade');
  return id.endsWith('_crest')
    ? t('heroDetails.tree.ui.action.awaken')
    : t('heroDetails.tree.ui.action.open');
});
</script>

<style scoped>
.detail {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 12px;
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  background: #0f1113;
  border: 1px solid color-mix(in srgb, var(--c) 40%, #23292c);
  color: #cbbfa6;
}
.icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--c) 22%, #121518);
  border: 2px solid var(--c);
  color: #f6eedc;
}
.icon svg {
  width: 55%;
  height: 55%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.title {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
}
.title b {
  color: #e8d7a8;
  font-family: 'Alegreya SC', serif;
  font-size: 1.15rem;
}
.title span {
  color: var(--c);
  font-size: 0.8rem;
  font-weight: 800;
}
.school {
  color: #a39886;
  font-size: 0.75rem;
}
.fx {
  margin: 6px 0 0;
  font-size: 0.85rem;
}
.fx--next {
  color: #a39886;
}
.fx--next em {
  color: var(--c);
  font-style: normal;
}
.req {
  margin: 6px 0 0;
  color: #d9a066;
  font-size: 0.8rem;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.cost {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}
.cost img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.action {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--c);
  background: color-mix(in srgb, var(--c) 30%, #121518);
  color: #f6eedc;
  font-weight: 800;
  cursor: pointer;
}
.action:disabled {
  border-color: #2a3236;
  background: #121518;
  color: #56636a;
  cursor: not-allowed;
}
</style>
