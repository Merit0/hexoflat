<template>
  <section ref="wrapperRef" class="path" data-testid="hero-path-content">
    <div
      ref="contentRef"
      class="path__content"
      :style="{ transform: `translate(${offsetX}px, 0) scale(${scale})` }"
    >
      <hero-skill-tree :view="view" @sacrifice="sacrifice" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { SacrificeOptionId } from '@hexoflat/engine/skills/sacrifice-rules';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { useFitToWidth } from '@/composables/use-fit-to-width';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroDetails } from '@/composables/use-hero-details';
import HeroSkillTree from './hero-skill-tree.vue';

const view = useHeroDetails();
const heroStore = useHeroStore();
const { wrapperRef, contentRef, scale, offsetX } = useFitToWidth();

function sacrifice(id: SkillId, option: SacrificeOptionId) {
  void heroStore.sacrificeToSkill(id, option);
}
</script>

<style scoped>
.path {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #15191b;
  font-family: 'Alegreya Sans', sans-serif;
}
.path__content {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  transform-origin: top left;
}
</style>
