<template>
  <div
      class="initialTileView battle-grid-tile"
  >
    <div class="damage-popup" v-if="damageValue">
      -{{ damageValue }}
    </div>
    <div class="blood-splash" v-if="bloodSplash"/>
    <div class="battle-tile"
         :class="{ 'dodged': wasDodged }"
    >
      <div class="enemy-stats-hover">
        ❤️ {{ enemy?.health }}
        ⚔️ {{ enemy?.attack }}
      </div>
      <div
          class="battle-body-tile-image"
      >
        <div class="podium-hero-image enemy-stand-base-top-view"/>
        <div
            class="podium-hero-image"
            :style="enemyStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps } from 'vue';
import TileModel from '@/a-game-scenes/silesia-world-scene/models/tile-model';
import { useBattleStore } from '@/stores/battle-store';
import EnemyModel from '@/models/EnemyModel';

const battleStore = useBattleStore();

const props = defineProps<{ tile: TileModel }>();

const enemy = computed(() => props.tile.enemies[0] || null);

const damageValue = computed(() => {
  return battleStore.damagePopups[props.tile.id] || null
});

const bloodSplash = computed(() => {
  return battleStore.bloodSplashTiles.includes(props.tile.id)
});

const wasDodged = computed(() => battleStore.missedEnemies.includes(props.tile.id));

const heroBattleTile = computed<TileModel | null>(() => {
  const tiles: TileModel[] = battleStore.tiles ?? [];
  return tiles.find((tile: TileModel) => tile.isHeroHere) ?? null;
});

const firstAliveEnemy = computed<EnemyModel | null>(
    () => props.tile.enemies.find(e => e.health > 0) ?? null
);
const enemyStyle = computed(() => {
  if (!firstAliveEnemy.value || !heroBattleTile.value) return {};

  const heroPos = heroBattleTile.value.coordinates;
  const mePos   = props.tile.coordinates;

  const dx = heroPos.x - mePos.x;
  const dy = heroPos.y - mePos.y;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const OFFSET = 270;
  const rotation = deg + OFFSET;

  return {
    backgroundImage: `url(${firstAliveEnemy.value.imgPath})`,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.25s linear',
  };
});
</script>

<style scoped>
@import "@/a-game-scenes/battlefield-scene/battlefield/styles/battlefield-map-tile-style.css";
@import "@/a-game-scenes/battlefield-scene/battlefield/styles/battle-enemy-tile-style.css";
@import "@/a-game-scenes/battlefield-scene/battlefield/styles/battle-effects-style.css";

.battle-tile.dodged {
  animation: dodgeShake 0.6s ease-in-out;
}

.battle-body-tile-image {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  transform: scale(0.25);
  transform-origin: center center;
  z-index: 10;
}
</style>