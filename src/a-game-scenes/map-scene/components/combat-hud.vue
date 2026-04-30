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
      <span class="chip" v-if="worldStore.combatActionMode">Mode: <b>{{ worldStore.combatActionMode.toUpperCase() }}</b></span>
      <span class="chip" v-else>Mode: <b>NONE</b></span>
      <span class="chip" v-if="worldStore.combatTurnSide === 'enemy'">Enemy is acting</span>
    </div>

    <div class="combat-hud__panels">
      <section class="combat-panel">
        <div class="combat-panel__title">Location</div>
        <div class="combat-panel__line">Name: <b>{{ locationTitle }}</b></div>
        <div class="combat-panel__line">Difficulty: <b>{{ locationDifficulty }}</b></div>
        <div class="combat-panel__line">Progress: <b>{{ mapProgressLabel }}</b></div>
        <div class="combat-panel__line combat-panel__line--stack">Enemies:</div>
        <div class="combat-tags">
          <span v-for="enemy in enemyRoster" :key="enemy.label" class="combat-tag">
            {{ enemy.label }} {{ enemy.alive }}/{{ enemy.total }}
          </span>
        </div>
      </section>

      <section v-if="bossInfo" class="combat-panel boss-panel">
        <div class="combat-panel__title">Boss</div>
        <div class="combat-panel__line">Name: <b>{{ bossInfo.name }}</b></div>
        <div class="combat-panel__line">HP: <b>{{ bossInfo.hp }}/{{ bossInfo.hpMax }}</b></div>
        <div class="combat-panel__line">Attack: <b>{{ bossInfo.attack }}</b></div>
        <div class="combat-panel__line">Steps: <b>{{ bossInfo.steps }}</b></div>
        <div class="combat-panel__line combat-panel__line--stack">Special:</div>
        <div class="combat-tags">
          <span v-for="skill in bossInfo.skills" :key="skill" class="combat-tag combat-tag--boss">
            {{ skill }}
          </span>
        </div>
      </section>
    </div>

    <div class="combat-hud__actions">
      <button
          class="combat-icon attack"
          :class="{ 'is-glowing': attackReady, 'is-dim': !attackReady }"
          type="button"
          disabled
          title="Attack becomes ready when axe is drawn"
      >
        <span>🪓</span>
      </button>

      <button
          class="combat-icon defend"
          :class="{ 'is-glowing': defendReady, 'is-active': worldStore.combatActionMode === 'defend', 'is-dim': !defendReady && worldStore.combatActionMode !== 'defend' }"
          type="button"
          :disabled="!heroControlsEnabled"
          @click="worldStore.beginCombatAction('defend')"
      >
        <span>🛡</span>
      </button>

      <button class="combat-btn end" type="button" :disabled="!heroControlsEnabled" @click="worldStore.advanceCombatTurn()">Next Turn</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { useWorldMapStore } from "@/stores/world-map-store";
import { HEXOBJECT_META } from "@/registry/hexobject-meta";
import { HEX_OBJECT_PROTOTYPES } from "@/registry/hexobjects/prototypes";
import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { Complexity } from "@/enums/complexity";

const worldStore = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const now = ref(Date.now());
let timer: number | null = null;
let lastAdvancedAt: number | null = null;

const moveBudget = computed(() => worldStore.getCombatMoveBudget());
const actorLabel = computed(() => worldStore.combatTurnSide === "hero" ? "Hero" : "Enemy");
const locationTitle = computed(() => worldStore.map?.name ?? "Unknown");
const locationDifficulty = computed(() => {
  switch (worldStore.map?.complexity) {
    case Complexity.EASY:
      return "Easy";
    case Complexity.NORMAL:
      return "Normal";
    case Complexity.HARD:
      return "Hard";
    case Complexity.EVIL:
      return "Evil";
    default:
      return "Unknown";
  }
});
const mapProgressLabel = computed(() => {
  const map = worldStore.map;
  if (!map?.tiles.length) return "0%";

  const revealed = map.tiles.filter((tile) => tile.isRevealed).length;
  const total = map.tiles.length;
  const percent = Math.round((revealed / total) * 100);
  return `${percent}% (${revealed}/${total})`;
});
const enemyRoster = computed(() => {
  const map = worldStore.map;
  if (!map) return [];

  const totalByKey = new Map<string, number>();
  for (const placement of map.config ?? []) {
    const key = placement.hexobject?.hexobjectKey;
    if (!key) continue;
    const proto = HEX_OBJECT_PROTOTYPES[key];
    if (!proto || proto.groupType !== EHexobjectGroup.CREATURE) continue;
    totalByKey.set(key, (totalByKey.get(key) ?? 0) + placement.coordinates.length);
  }

  const aliveByKey = new Map<string, number>();
  for (const tile of map.tiles) {
    const key = tile.hexobject?.hexobjectKey;
    if (!key) continue;
    if (tile.hexobject?.groupType !== EHexobjectGroup.CREATURE) continue;
    aliveByKey.set(key, (aliveByKey.get(key) ?? 0) + 1);
  }

  return [...totalByKey.entries()].map(([key, total]) => ({
    label: HEXOBJECT_META[key]?.title ?? key,
    total,
    alive: aliveByKey.get(key) ?? 0,
  }));
});
const bossInfo = computed(() => {
  const bossTile = worldStore.map?.tiles.find((tile) =>
      tile.hexobject?.groupType === EHexobjectGroup.CREATURE &&
      [HEXOBJECT_KEYS.SKELETOR, HEXOBJECT_KEYS.EMITTER, HEXOBJECT_KEYS.INFERNO].includes(tile.hexobject.hexobjectKey as any)
  );
  const bossHexobject = bossTile?.hexobject;
  if (!bossHexobject || bossHexobject.groupType !== EHexobjectGroup.CREATURE) return null;

  const key = bossHexobject.hexobjectKey;
  const skills = key === HEXOBJECT_KEYS.SKELETOR
      ? ["Bone Cleave", "Crypt Rush", "Grave Omen"]
      : key === HEXOBJECT_KEYS.INFERNO
          ? ["Hellfire", "Burning Wake", "Ash Pulse"]
          : ["Static Surge", "Pulse Grid", "Arc Burst"];

  return {
    name: bossHexobject.creature.name,
    hp: bossHexobject.creature.hp,
    hpMax: bossHexobject.creature.hpMax,
    attack: bossHexobject.creature.attack ?? 1,
    steps: worldStore.getCombatMoveBudget(),
    skills,
  };
});
const heroControlsEnabled = computed(() => {
  return worldStore.combatTurnSide === "hero"
      && !worldStore.isEnemyTurnResolving
      && !worldStore.isHeroMoving;
});
const attackReady = computed(() => {
  return heroControlsEnabled.value
      && !worldStore.combatAttackUsed
      && heroToolStore.activeTool === HEXOBJECT_KEYS.AXE
      && heroToolStore.isDragging;
});
const defendReady = computed(() => {
  return heroControlsEnabled.value
      && !worldStore.combatDefendUsed;
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

watch(
    () => [worldStore.combatActive, worldStore.combatTurnSide, worldStore.isEnemyTurnResolving] as const,
    ([active, side, resolving]) => {
      if (!active || side !== "enemy" || resolving) return;
      void worldStore.ensureEnemyTurnResolution();
    },
    { immediate: true }
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

.combat-hud__panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 10px;
}

.combat-panel {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.boss-panel {
  border-color: rgba(255, 116, 116, 0.24);
  box-shadow: inset 0 0 0 1px rgba(255, 116, 116, 0.08);
}

.combat-panel__title {
  color: rgba(240, 248, 255, 0.94);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.combat-panel__line {
  color: rgba(220, 235, 255, 0.88);
  font-size: 0.85rem;
  letter-spacing: 0.04em;
}

.combat-panel__line--stack {
  margin-bottom: -2px;
}

.combat-panel__line b {
  color: rgba(245, 250, 255, 0.96);
}

.combat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.combat-tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(190, 220, 255, 0.14);
  color: rgba(220, 235, 255, 0.9);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.combat-tag--boss {
  border-color: rgba(255, 116, 116, 0.28);
  background: rgba(100, 20, 20, 0.24);
  color: rgba(255, 218, 218, 0.94);
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
  box-shadow: 0 0 0 1px rgba(255,255,255,0.16), 0 0 18px rgba(255, 126, 126, 0.28);
}

.combat-icon.defend.is-glowing {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.16), 0 0 18px rgba(120, 176, 255, 0.28);
}

.combat-icon.is-active {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.16), 0 0 22px rgba(120, 176, 255, 0.34);
}

.combat-icon.is-dim {
  opacity: 0.38;
  filter: saturate(0.4);
}

@media (max-width: 920px) {
  .combat-hud__panels {
    grid-template-columns: 1fr;
  }
}
</style>
