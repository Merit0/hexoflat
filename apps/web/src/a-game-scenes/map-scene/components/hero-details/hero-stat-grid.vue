<template>
  <div class="grid" data-testid="hero-stat-grid">
    <div
      v-for="tile in view.tiles"
      :key="tile.id"
      class="tile"
      :data-testid="`hero-stat-${tile.id}`"
    >
      <svg
        class="icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        :data-testid="`hero-stat-${tile.id}-icon`"
      >
        <path :d="ICON_PATHS[ICON_BY_STAT[tile.id]]" />
      </svg>
      <span class="label" :data-testid="`hero-stat-${tile.id}-label`">{{
        labels.stat[tile.id]
      }}</span>
      <span class="value" :data-testid="`hero-stat-${tile.id}-value`">{{ tile.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HeroDetailsView, HeroStatId } from '@/composables/use-hero-details';
import { ICON_PATHS, type TIconName } from '@/components/gui/icons/item-icons';
import { useHeroDetailsLabels } from './use-hero-details-labels';

defineProps<{ view: HeroDetailsView }>();

const ICON_BY_STAT: Record<HeroStatId, TIconName> = {
  attack: 'sword',
  defense: 'shield',
  load: 'weight',
  victories: 'victory',
};

const labels = useHeroDetailsLabels();
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.tile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-height: 56px;
  border-radius: 14px;
  background: #29333a;
  border: 1px solid #3a474e;
}
.icon {
  flex: none;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: #cbbfa6;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.label {
  flex: 1;
  color: #ede3d2;
  font-size: 1rem;
}
.value {
  color: #e8d7a8;
  font-size: 1.15rem;
  font-weight: 800;
}
</style>
