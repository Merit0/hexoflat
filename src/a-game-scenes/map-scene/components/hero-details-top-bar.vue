<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="hero-badge">
        <div class="hero-badge__sub">
          <div class="hero-badge__name chip">{{ heroName }}</div>
          <span class="chip">Steps: <b>{{ heroSteps }}</b></span>
          <span class="chip">Pos: <b>q{{ heroQ }}</b> · <b>r{{ heroR }}</b></span>
          <span class="chip" v-if="toolLabel">Tool: <b>{{ toolLabel }}</b></span>
          <span class="chip" v-if="heroToolStore.isLocked">Status: <b>LOCKED</b></span>
          <span class="chip muted" v-else>Status: <b>READY</b></span>
        </div>
      </div>
    </div>

    <div class="topbar__center chip">
      <div class="stat">
        <div class="stat__label">HP</div>
        <div class="stat__bar">
          <div class="stat__fill" :style="{ width: hpPercent + '%' }"></div>
        </div>
        <div class="stat__value">{{ heroHp }}/{{ heroHpMax }}</div>
      </div>
    </div>

    <div class="topbar__right">
      <div class="topbar__logger">
        <game-events-logger/>
      </div>

      <button @click="userStore.logout()" class="logout">Logout</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHeroStore } from "@/stores/hero-store";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { useWorldMapStore } from "@/stores/world-map-store";
import { useUserStore } from "@/stores/user-store";
import GameEventsLogger from "@/a-game-scenes/game-events-logger/components/game-events-logger.vue";

const worldStore = useWorldMapStore();
const heroStore = useHeroStore();
const heroToolStore = useHeroToolStore();
const userStore = useUserStore();

const activeTool = computed(() => heroToolStore.activeTool);

const heroName = computed(() => heroStore.hero?.name ?? "Hero");
const heroSteps = computed(() => heroStore.hero?.heroSteps ?? 0);

const heroQ = computed(() => worldStore.heroCoordinates?.columnIndex ?? 0);
const heroR = computed(() => worldStore.heroCoordinates?.rowIndex ?? 0);

const heroHp = computed(() => (heroStore as any)?.heroHp ?? (worldStore as any)?.hero?.hp ?? 100);
const heroHpMax = computed(() => (heroStore as any)?.heroHpMax ?? (worldStore as any)?.hero?.hpMax ?? 100);

const hpPercent = computed(() => {
  const max = Math.max(1, Number(heroHpMax.value) || 1);
  const val = Math.max(0, Math.min(max, Number(heroHp.value) || 0));
  return Math.round((val / max) * 100);
});

const toolLabel = computed(() => {
  const t = activeTool.value;
  if (!t) return "";
  return String(t).toUpperCase();
});
</script>

<style scoped>
.topbar {
  position: fixed;
  inset: 0 0 auto 0;
  height: 64px;
  z-index: 5000;

  display: grid;
  grid-template-columns: 1fr minmax(260px, 420px) 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;

  background: linear-gradient(180deg, rgba(10, 12, 16, 0.92), rgba(10, 12, 16, 0.72));
  border-bottom: 1px solid rgba(220, 237, 255, 0.1);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.topbar__left,
.topbar__center,
.topbar__right {
  display: flex;
  align-items: center;
}

.topbar__left {
  justify-content: flex-start;
}

.topbar__center {
  justify-content: center;
}

.topbar__right {
  justify-content: flex-end;
  gap: 8px;
  min-width: 0; /* ✅ щоб елементи могли стискатись без зламу гріду */
}

/* ✅ Обгортка для логера в топбарі */
.topbar__logger {
  display: flex;
  align-items: center;
  min-width: 0;
}

/* (твоє — лишаю як є) */
.hero-badge__name {
  font-family: var(--font-main, serif), serif;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(232, 242, 255, 0.92);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.hero-badge__sub {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  height: 28px;
  padding: 0 10px;
  border-radius: 999px;

  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(190, 220, 255, 0.14);
  color: rgba(220, 235, 255, 0.9);

  font-size: 1rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chip b {
  font-weight: 800;
  color: rgba(240, 248, 255, 0.95);
}

.chip.muted {
  opacity: 0.75;
}

.stat {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: center;
  gap: 10px;
  width: min(420px, 50vw);
}

.stat__label {
  font-size: 1rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(190, 220, 255, 0.75);
}

.stat__bar {
  height: 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(190, 220, 255, 0.12);
  overflow: hidden;
}

.stat__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(150, 200, 255, 0.55), rgba(230, 245, 255, 0.85));
  box-shadow: 0 0 18px rgba(140, 185, 255, 0.25);
}

.stat__value {
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: rgba(230, 245, 255, 0.88);
}

/* ⚠️ Я трохи підправив logout: fixed width/height на vw дає дивні розміри.
   Якщо хочеш лишити як є — повернеш назад, але так стабільніше. */
.logout {
  height: 32px;
  padding: 0 14px;
  color: rgb(255, 197, 197);
  font-size: 0.95rem;
  font-weight: 600;
  background-color: rgb(22, 22, 23);
  border: 1px solid rgb(255, 223, 223);
  border-radius: 999px;
  cursor: pointer;
}
.logout:hover {
  filter: brightness(1.06);
}
</style>