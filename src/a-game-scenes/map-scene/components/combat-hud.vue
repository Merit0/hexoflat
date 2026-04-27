<template>
  <aside v-if="worldStore.combatActive" class="combat-hud">
    <div class="combat-hud__title">Combat Mode</div>

    <div class="combat-hud__row">
      <span class="chip">Turn: <b>{{ actorLabel }}</b></span>
      <span class="chip">Steps Left: <b>{{ worldStore.combatStepsLeft }}</b></span>
      <span class="chip">Move Budget: <b>{{ moveBudget }}</b></span>
      <span class="chip timer">Timer: <b>{{ secondsLeft }}s</b></span>
    </div>

    <div class="combat-hud__row">
      <span class="chip" v-if="worldStore.combatActionMode">Action: <b>{{ worldStore.combatActionMode.toUpperCase() }}</b></span>
      <span class="chip" v-else>Action: <b>NONE</b></span>
      <span class="chip" v-if="worldStore.combatTurnSide === 'enemy'">Enemy turn is manual</span>
    </div>

    <div class="combat-hud__actions">
      <button class="combat-btn attack" type="button" @click="worldStore.beginCombatAction('attack')">Attack</button>
      <button class="combat-btn defend" type="button" @click="worldStore.beginCombatAction('defend')">Defend</button>
      <button class="combat-btn muted" type="button" @click="worldStore.cancelCombatAction()">Cancel</button>
      <button class="combat-btn end" type="button" @click="worldStore.advanceCombatTurn()">Next Turn</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useWorldMapStore } from "@/stores/world-map-store";

const worldStore = useWorldMapStore();
const now = ref(Date.now());
let timer: number | null = null;
let lastAdvancedAt: number | null = null;

const moveBudget = computed(() => worldStore.getCombatMoveBudget());
const actorLabel = computed(() => worldStore.combatTurnSide === "hero" ? "Hero" : "Enemy");
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
    { immediate: true }
);

watch(
    () => [worldStore.combatActive, secondsLeft.value, worldStore.combatTurnEndsAt] as const,
    ([active, seconds, endsAt]) => {
      if (!active || seconds > 0 || !endsAt) return;
      if (lastAdvancedAt === endsAt) return;

      lastAdvancedAt = endsAt;
      worldStore.advanceCombatTurn();
    }
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
</style>
