<template>
  <aside v-if="worldStore.combatActive" class="combat-hud" data-testid="combat-hud">
    <div class="combat-hud__title">Combat Mode</div>

    <div class="combat-hud__row">
      <span class="chip" data-testid="combat-hud-turn-chip"
        >Turn: <b>{{ actorLabel }}</b></span
      >
      <span class="chip" data-testid="combat-hud-steps-left-chip"
        >Steps Left: <b>{{ worldStore.combatStepsLeft }}</b></span
      >
      <span class="chip"
        >Move Budget: <b>{{ moveBudget }}</b></span
      >
      <span class="chip timer" data-testid="combat-hud-timer"
        >Timer: <b>{{ secondsLeft }}s</b></span
      >
    </div>

    <div class="combat-hud__row">
      <span v-if="worldStore.combatActionMode" class="chip" data-testid="combat-hud-mode-chip"
        >Mode: <b>{{ worldStore.combatActionMode.toUpperCase() }}</b></span
      >
      <span v-else class="chip" data-testid="combat-hud-mode-chip">Mode: <b>NONE</b></span>
      <span v-if="worldStore.combatTurnSide === 'enemy'" class="chip">Enemy is acting</span>
    </div>

    <div class="combat-hud__actions">
      <button
        class="combat-icon attack"
        data-testid="combat-hud-attack-button"
        :class="{ 'is-glowing': attackReady, 'is-dim': !attackReady }"
        type="button"
        disabled
        :title="
          attackReady
            ? 'Drop the weapon on a target tile to attack'
            : 'Attack becomes ready when a weapon is drawn'
        "
      >
        <span>🪓</span>
      </button>

      <button
        class="combat-btn end"
        data-testid="combat-hud-next-turn-button"
        type="button"
        :disabled="!heroControlsEnabled"
        @click="worldStore.advanceCombatTurn()"
      >
        Next Turn
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { getToolCapabilities } from '@/game-resolvers/interactions-resolver';

const worldStore = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const now = ref(Date.now());
let timer: number | null = null;
let lastAdvancedAt: number | null = null;

const moveBudget = computed(() => worldStore.getCombatMoveBudget());
const actorLabel = computed(() => (worldStore.combatTurnSide === 'hero' ? 'Hero' : 'Enemy'));
const heroControlsEnabled = computed(() => {
  return (
    worldStore.combatTurnSide === 'hero' &&
    !worldStore.isEnemyTurnResolving &&
    !worldStore.isHeroMoving
  );
});
const attackReady = computed(() => {
  return (
    heroControlsEnabled.value &&
    !worldStore.combatAttackUsed &&
    !!heroToolStore.activeTool &&
    !!getToolCapabilities(heroToolStore.activeTool).canAttack &&
    heroToolStore.isDragging
  );
});
const secondsLeft = computed(() => {
  const endsAt = worldStore.combatTurnEndsAt;
  if (!worldStore.combatActive || !endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - now.value) / 1000));
});

watch(
  () => worldStore.combatActive,
  (active) => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }

    if (!active) return;

    timer = window.setInterval(() => {
      now.value = Date.now();
    }, 250);
  },
  { immediate: true },
);

watch(
  () => [worldStore.combatActive, secondsLeft.value, worldStore.combatTurnEndsAt] as const,
  ([active, seconds, endsAt]) => {
    if (!active || seconds > 0 || !endsAt) return;
    if (lastAdvancedAt === endsAt) return;

    lastAdvancedAt = endsAt;
    worldStore.advanceCombatTurn();
  },
);

watch(
  () =>
    [worldStore.combatActive, worldStore.combatTurnSide, worldStore.isEnemyTurnResolving] as const,
  ([active, side, resolving]) => {
    if (!active || side !== 'enemy' || resolving) return;
    void worldStore.ensureEnemyTurnResolution();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.combat-hud {
  position: fixed;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 5200;
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 110, 110, 0.35);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(28, 8, 10, 0.96), rgba(18, 7, 9, 0.9));
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
}

@media (max-width: 640px) {
  .combat-hud {
    left: 10px;
    right: 10px;
    bottom: 10px;
    padding: 10px 12px;
  }

  .combat-hud__row {
    gap: 6px;
  }

  .combat-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}

.combat-hud__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 176, 176, 0.92);
}

.combat-hud__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.combat-hud__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.combat-btn {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  cursor: pointer;
}

.combat-btn:disabled,
.combat-icon:disabled {
  cursor: default;
  opacity: 0.38;
  filter: saturate(0.4);
  box-shadow: none;
}

.combat-btn.attack {
  border-color: rgba(255, 120, 120, 0.45);
}

.combat-btn.defend {
  border-color: rgba(120, 176, 255, 0.45);
}

.combat-btn.end {
  border-color: rgba(255, 216, 120, 0.4);
}

.combat-btn.muted {
  opacity: 0.82;
}

.timer {
  color: rgba(255, 213, 154, 0.95);
}

.combat-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  font-size: 24px;
}

.combat-icon.attack {
  border-color: rgba(255, 120, 120, 0.45);
}

.combat-icon.defend {
  border-color: rgba(120, 176, 255, 0.45);
  cursor: pointer;
}

.combat-icon.is-glowing {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.16),
    0 0 18px rgba(255, 126, 126, 0.28);
}

.combat-icon.defend.is-glowing {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.16),
    0 0 18px rgba(120, 176, 255, 0.28);
}

.combat-icon.is-active {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.16),
    0 0 22px rgba(120, 176, 255, 0.34);
}

.combat-icon.is-dim {
  opacity: 0.38;
  filter: saturate(0.4);
}
</style>
