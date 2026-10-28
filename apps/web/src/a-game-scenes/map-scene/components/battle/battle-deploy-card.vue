<template>
  <div class="deploy" data-testid="battle-deploy-card">
    <div class="deploy__card" :class="{ 'is-ambush': deploy.ambush }">
      <div class="deploy__title">
        {{ deploy.ambush ? t('battle.deploy.ambush') : t('battle.deploy.attack') }}
      </div>
      <p class="deploy__text">
        {{ deploy.ambush ? t('battle.deploy.ambushText') : t('battle.deploy.attackText') }}
      </p>
      <div class="deploy__chips">
        <span class="deploy__chip">{{ t('battle.deploy.board', { place: deploy.place }) }}</span>
        <span class="deploy__chip">{{ t('battle.deploy.seed', { seed: deploy.seed }) }}</span>
        <span class="deploy__chip">
          {{ t('battle.deploy.approach', { approach: deploy.approach }) }}
        </span>
      </div>
    </div>
    <div class="deploy__heading">{{ t('battle.enemies') }}</div>
    <div v-for="enemy in deploy.enemies" :key="enemy.id" class="deploy__enemy">
      <span class="deploy__enemy-hex"></span>
      <span class="deploy__enemy-name">{{ enemy.name }}</span>
      <span class="deploy__enemy-meta">
        {{ t('battle.deploy.enemyMeta', { hearts: enemy.maxHp / 2 }) }} ·
        {{ t(`battle.roleShort.${enemy.behaviour}`) }}
      </span>
    </div>
    <button class="deploy__start" type="button" data-testid="battle-start" @click="emit('start')">
      {{ t('battle.deploy.start') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleDeployView } from '@/composables/battle-view';

defineProps<{ deploy: BattleDeployView }>();
const emit = defineEmits<{ start: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.deploy {
  display: grid;
  gap: 10px;
}
.deploy__card {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #4a8be0;
  background: #1a2a3c;
}
.deploy__card.is-ambush {
  border-color: #c2412d;
  background: #2a161c;
}
.deploy__title {
  text-transform: uppercase;
  color: #8fc0f0;
  font-family: Cinzel, serif;
  font-size: 1.1rem;
  font-weight: 700;
}
.is-ambush .deploy__title {
  color: #ffb4a6;
}
.deploy__text {
  margin: 0;
  color: #ede3d2;
  font-family: 'Alegreya Sans', sans-serif;
}
.deploy__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.deploy__chip {
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid #36424a;
  background: #121517;
  color: #cbbfa6;
  font-size: 0.8rem;
}
.deploy__heading {
  color: #f08a7a;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.deploy__enemy {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 12px;
  background: #262e33;
  border: 1px solid #36424a;
}
.deploy__enemy-hex {
  width: 16px;
  height: 18px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: linear-gradient(160deg, #b0306a, #4e0c27);
}
.deploy__enemy-name {
  flex: 1;
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-weight: 700;
}
.deploy__enemy-meta {
  color: #8e9599;
  font-size: 0.85rem;
}
.deploy__start {
  text-transform: uppercase;
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid #b0306a;
  background: linear-gradient(180deg, #8c1c47, #5a0f2c);
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
</style>
