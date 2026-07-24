<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="hero-badge">
        <div class="hero-badge__sub">
          <div class="hero-badge__name chip">{{ heroName }}</div>
          <div class="chip chip--with-popover">
            Steps: <b>{{ heroSteps }}</b>
            <div class="chip-popover">
              <div class="chip-popover__title">{{ scoutRankLabel }}</div>
              <div class="chip-popover__line">Move Steps: <b>{{ scoutMoveSteps }}</b></div>
              <div class="chip-popover__line">Steps Walked: <b>{{ heroSteps }}</b></div>
              <div class="chip-popover__line">
                Next Rank:
                <b>{{ nextScoutRankAt ?? "MAX" }}</b>
              </div>
            </div>
          </div>
          <span class="chip">Scout: <b>{{ scoutRankShort }}</b></span>
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
      <span class="chip">Map: <b>{{ heroLocation }}</b></span>
      <button class="settings-btn" type="button" @click="openSettings">⚙</button>
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
import { useOverlayStore } from "@/stores/overlay-store";
import { useHeroInventoryStore } from "@/stores/hero-inventory-store";
import GameEventsLogger from "@/a-game-scenes/game-events-logger/components/game-events-logger.vue";
import {MapRegistry} from "@/registry/world-map-registry";
import { getScoutProgress } from "@/services/hero-movement/scout-progression";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

const worldStore = useWorldMapStore();
const heroStore = useHeroStore();
const heroToolStore = useHeroToolStore();
const heroInventoryStore = useHeroInventoryStore();
const userStore = useUserStore();
const overlayStore = useOverlayStore();

const heroName = computed(() => heroStore.hero?.name ?? "Hero");
const heroSteps = computed(() => heroStore.hero?.heroSteps ?? 0);
const scoutProgress = computed(() => getScoutProgress(heroSteps.value));
const scoutMoveSteps = computed(() => scoutProgress.value.moveSteps);
const scoutRankLabel = computed(() => scoutProgress.value.rankLabel);
const nextScoutRankAt = computed(() => scoutProgress.value.nextRankAt);
const scoutRankShort = computed(() => `R${scoutProgress.value.current.rank}`);

function formatHeroStat(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const heroHp = computed(() => formatHeroStat(heroStore.hero.currentHealth ?? 0));
const heroHpMax = computed(() => formatHeroStat(heroStore.hero.maxHealth ?? 100));

const hpPercent = computed(() => {
  const max = Math.max(1, Number(heroStore.hero.maxHealth ?? 100) || 1);
  const val = Math.max(0, Math.min(max, Number(heroStore.hero.currentHealth ?? 0) || 0));
  return Math.round((val / max) * 100);
});

const heroLocation = computed(() => {
  const key = heroStore.nav.locationKey;
  if (!key) return "Nowhere";

  return MapRegistry.get(key)?.title ?? key;
});

function resolveHandLabel(itemKey: string | undefined) {
  if (!itemKey || itemKey === HEXOBJECT_KEYS.HAND) return "hand";
  if (String(itemKey).toLowerCase().includes("shield")) return "shield";
  return "weapon";
}

const toolLabel = computed(() => {
  const equipped = heroInventoryStore.equippedItems;
  const weaponLabel = resolveHandLabel(equipped.weapon?.key);
  const shieldLabel = resolveHandLabel(equipped.shield?.key);
  return `${weaponLabel} ${shieldLabel}`;
});

function openSettings() {
  overlayStore.openOverlay("settings");
}
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

.settings-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid rgba(190, 220, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(240, 248, 255, 0.95);
  font-size: 18px;
  cursor: pointer;
  opacity: 0;
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

.chip--with-popover {
  position: relative;
  cursor: help;
}

.chip b {
  font-weight: 800;
  color: rgba(240, 248, 255, 0.95);
}

.chip.muted {
  opacity: 0.75;
}

.chip-popover {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  min-width: 260px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(8, 11, 16, 0.96);
  border: 1px solid rgba(190, 220, 255, 0.18);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 30;
}

.chip--with-popover:hover .chip-popover {
  opacity: 1;
  transform: translateY(0);
}

.chip-popover__title {
  margin-bottom: 8px;
  color: rgba(240, 248, 255, 0.96);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: none;
}

.chip-popover__line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: rgba(214, 230, 248, 0.88);
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: none;
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
