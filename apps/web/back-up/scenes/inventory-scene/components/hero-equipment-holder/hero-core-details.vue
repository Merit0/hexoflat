<template>
  <div class="hero-details-container">
    <div class="stat-row" v-for="(stat, index) in stats" :key="index">
      <span class="tooltip">{{ stat.tooltip }}</span>
      <div class="icon" :class="stat.iconClass"/>
      <div class="bar-container-image">
        <div class="bar-container">
          <div
              class="bar-fill"
              :class="{ danger: stat.name === 'Health' && stat.percentage <= 25 }"
              :style="{
            width: stat.percentage + '%',
            background: stat.fillColor
          }"
          >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, computed} from 'vue';
import {useHeroStore} from '@stores/hero-store';

export default defineComponent({
  name: 'hero-core-details',
  setup() {
    const {hero} = useHeroStore();
    const healthPercentage = computed(() => {
      if (!hero.maxHealth || hero.maxHealth === 0) return 0;
      return Math.min(100, Math.round((hero.currentHealth / hero.maxHealth) * 100));
    });

    const stats = computed(() => [
      {
        name: 'Health',
        percentage: Math.round((hero.currentHealth / hero.maxHealth) * 100),
        fillColor: 'linear-gradient(to right, #d32f2f 0%, #f06292 35%, #ff9800 70%, #ffeb3b 100%)',
        tooltip: `${healthPercentage.value}%`,
        iconClass: 'heart-icon',
      },
      {
        name: 'Attack',
        percentage: Math.min(hero.attack * 10, 100),
        fillColor: '#4a75ff',
        tooltip: `${hero.attack}`,
        iconClass: 'crossed-swords-icon',
      },
      {
        name: 'Defense',
        percentage: 0,
        fillColor: '#8d6e63',
        tooltip: `0`,
        iconClass: 'shield-icon',
      },
    ]);

    return {stats};
  }
});
</script>

<style scoped>
@import '@/a-game-scenes/inventory-scene/styles/hero-core-details-style.css';
</style>