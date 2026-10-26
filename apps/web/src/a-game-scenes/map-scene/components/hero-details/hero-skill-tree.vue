<template>
  <div class="tree" data-testid="hero-skill-tree">
    <div class="root" data-testid="hero-skill-root">
      <img class="root__icon" :src="WILL_ICON_URL" alt="" />
      <div class="root__value" data-testid="hero-skill-will">
        <b>{{ view.will?.current ?? 0 }}</b
        ><small> /{{ view.will?.capacity ?? 0 }}</small>
      </div>
    </div>
    <div class="trunk"></div>
    <div class="branches">
      <skill-branch-column
        v-for="branch in view.skillTree.branches"
        :key="branch.id"
        :branch="branch"
        :selected-id="selectedId"
        :active="selected?.branch === branch.id"
        @select="selectedId = $event"
      />
    </div>
    <div class="reset">
      <template v-if="confirming">
        <button
          class="reset__btn reset__btn--danger"
          type="button"
          data-testid="hero-skill-reset-confirm"
          @click="confirmReset"
        >
          {{ t('heroDetails.tree.ui.reset.confirm') }}
        </button>
        <button
          class="reset__btn"
          type="button"
          data-testid="hero-skill-reset-cancel"
          @click="confirming = false"
        >
          {{ t('heroDetails.tree.ui.reset.cancel') }}
        </button>
      </template>
      <button
        v-else
        class="reset__btn"
        type="button"
        :disabled="!view.skillTree.canReset"
        data-testid="hero-skill-reset"
        @click="confirming = true"
      >
        {{ t('heroDetails.tree.ui.reset.button') }}
      </button>
    </div>
    <skill-detail-panel
      v-if="selected"
      :node="selected"
      :options="view.skillTree.options"
      @sacrifice="(id, option) => emit('sacrifice', id, option)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SacrificeOptionId } from '@hexoflat/engine/skills/sacrifice-rules';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { findSkillNode } from '@/composables/skill-tree-view';
import { WILL_ICON_URL, type HeroDetailsView } from '@/composables/use-hero-details';
import SkillBranchColumn from './skill-branch-column.vue';
import SkillDetailPanel from './skill-detail-panel.vue';

const props = defineProps<{ view: HeroDetailsView }>();
const emit = defineEmits<{ sacrifice: [SkillId, SacrificeOptionId]; reset: [] }>();
const { t } = useI18n();
const confirming = ref(false);

function confirmReset() {
  confirming.value = false;
  emit('reset');
}

const selectedId = ref<SkillId>('b_crest');
const selected = computed(() => findSkillNode(props.view.skillTree, selectedId.value));
</script>

<style scoped>
.tree {
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
.trunk {
  width: 2px;
  height: 16px;
  background: #3a474e;
}
.branches {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.reset {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}
.reset__btn {
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid #3a474e;
  background: #121518;
  color: #cbbfa6;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.reset__btn--danger {
  border-color: #c9345f;
  color: #ffb8c8;
}
.reset__btn:disabled {
  color: #56636a;
  cursor: not-allowed;
}
</style>
