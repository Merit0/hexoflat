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
      <skill-progress-bar :node="node" :preview-amount="previewAmount" />
      <p v-if="node.status === 'soon'" class="soon" data-testid="hero-skill-detail-soon">
        {{ t('heroDetails.tree.ui.soon') }}
      </p>
      <div v-else-if="node.nextCost !== null" class="sacrifice">
        <span class="sacrifice__title">{{ t('heroDetails.tree.ui.sacrifice.title') }}</span>
        <div class="sacrifice__row">
          <button
            v-for="option in options"
            :key="option.id"
            class="option"
            type="button"
            :disabled="!canSacrifice(option)"
            :data-testid="`hero-skill-sacrifice-${option.id}`"
            @click="emit('sacrifice', node.id, option.id)"
            @mouseenter="hovered = option"
            @mouseleave="hovered = null"
            @focus="hovered = option"
            @blur="hovered = null"
          >
            <b :data-testid="`hero-skill-sacrifice-${option.id}-amount`">+{{ option.amount }}</b>
            <small>{{ optionLabels[option.id] }}</small>
          </button>
        </div>
        <p v-if="afterText" class="after" data-testid="hero-skill-sacrifice-after">
          {{ afterText }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SacrificeOption, SacrificeOptionId } from '@hexoflat/engine/skills/sacrifice-rules';
import { SKILLS, type SkillId } from '@hexoflat/engine/skills/skill-content';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import { previewSacrifice, type SkillNodeView } from '@/composables/skill-tree-view';
import SkillProgressBar from './skill-progress-bar.vue';
import { BRANCH_COLOR, SKILL_ICON } from '@/components/gui/icons/skill-presentation';
import { useSkillTexts } from './use-skill-texts';

const props = defineProps<{ node: SkillNodeView; options: SacrificeOption[] }>();
const emit = defineEmits<{ sacrifice: [SkillId, SacrificeOptionId] }>();
const { t, name, branchName, effectText } = useSkillTexts();

const hovered = ref<SacrificeOption | null>(null);

const optionLabels = computed<Record<SacrificeOptionId, string>>(() => ({
  small: t('heroDetails.tree.ui.sacrifice.small'),
  medium: t('heroDetails.tree.ui.sacrifice.medium'),
  all: t('heroDetails.tree.ui.sacrifice.all'),
}));

function canSacrifice(option: SacrificeOption): boolean {
  return props.node.status === 'ready' && option.affordable;
}

const previewAmount = computed(() =>
  hovered.value && canSacrifice(hovered.value) ? hovered.value.amount : 0,
);

const afterText = computed(() => {
  if (!previewAmount.value) return '';
  const after = previewSacrifice(props.node, previewAmount.value);
  if (after.cost === null) return t('heroDetails.tree.ui.sacrifice.afterMax');
  return t('heroDetails.tree.ui.sacrifice.after', {
    rank: after.rank,
    progress: after.progress,
    cost: after.cost,
  });
});

const requiredNames = computed(() =>
  SKILLS[props.node.id].requires.map((id) => name(id)).join(', '),
);
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
.soon {
  margin: 10px 0 0;
  color: #a39886;
  font-style: italic;
  font-size: 0.85rem;
}
.sacrifice {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.sacrifice__title {
  color: #a39886;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.sacrifice__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.option {
  display: grid;
  justify-items: center;
  padding: 6px 4px;
  border-radius: 10px;
  border: 1px solid var(--c);
  background: color-mix(in srgb, var(--c) 28%, #121518);
  color: #f6eedc;
  cursor: pointer;
}
.option b {
  font-size: 1rem;
}
.option small {
  color: color-mix(in srgb, var(--c) 60%, #fff);
  font-size: 0.65rem;
}
.option:disabled {
  border-color: #2a3236;
  background: #121518;
  color: #56636a;
  cursor: not-allowed;
}
.option:disabled small {
  color: #56636a;
}
.after {
  margin: 0;
  color: var(--c);
  font-size: 0.78rem;
  font-weight: 700;
}
</style>
