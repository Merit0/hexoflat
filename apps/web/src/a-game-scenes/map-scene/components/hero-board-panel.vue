<template>
  <aside
    class="hero-board-panel"
    :class="{ 'is-collapsed': !isHeroBoardOpen }"
    data-testid="hero-board-panel"
  >
    <button
      class="hero-board-rail"
      type="button"
      :aria-expanded="isHeroBoardOpen"
      :aria-label="isHeroBoardOpen ? 'Hide hero board' : 'Show hero board'"
      data-testid="hero-board-toggle"
      @click="toggleHeroBoardOpen"
    >
      <span class="hero-board-rail__chevron">{{ isHeroBoardOpen ? '›' : '‹' }}</span>
    </button>

    <div v-show="isHeroBoardOpen" class="hero-board-content">
      <div class="hero-board-body">
        <header class="board-top">
          <div class="tabs">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              class="tab"
              :class="{ 'is-active': activeTab === tab.id, 'is-disabled': tab.disabled }"
              :data-testid="`hero-board-tab-${tab.id}`"
              :disabled="tab.disabled"
              type="button"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </header>

        <section
          v-if="activeTab === 'hero'"
          class="tab-panel hero-tab"
          data-testid="hero-tab-content"
        >
          <div class="hero-badge__name" data-testid="topbar-hero-name">{{ heroName }}</div>

          <div class="hero-divider"></div>

          <div class="faith-section" data-testid="hero-faith-bar">
            <div class="section-label">Faith</div>
            <div class="faith-bar">
              <div class="faith-bar__half faith-bar__half--good"></div>
              <div class="faith-bar__half faith-bar__half--evil"></div>
            </div>
          </div>

          <div class="hero-divider"></div>

          <div class="hp-section" data-testid="topbar-hp-bar">
            <div class="section-label">Health</div>
            <hp-hearts :percent="hpPercent" data-testid="topbar-hp-value" />
          </div>

          <div class="hero-divider"></div>

          <div class="hp-section" data-testid="hero-defence-bar">
            <div class="section-label">Defence</div>
            <defence-shields :percent="defencePercent" />
          </div>

          <div class="hero-divider"></div>

          <div class="chip-row">
            <div
              class="chip chip--with-popover"
              :class="{ 'chip--popover-open': isStepsPopoverOpen }"
              tabindex="0"
              data-testid="topbar-steps-chip"
              @click="isStepsPopoverOpen = !isStepsPopoverOpen"
              @focusout="isStepsPopoverOpen = false"
            >
              Steps: <b>{{ heroSteps }}</b>
              <div class="chip-popover">
                <div class="chip-popover__title">{{ scoutRankLabel }}</div>
                <div class="chip-popover__line">
                  Move Steps: <b>{{ scoutMoveSteps }}</b>
                </div>
                <div class="chip-popover__line">
                  Steps Walked: <b>{{ heroSteps }}</b>
                </div>
                <div class="chip-popover__line">
                  Next Rank:
                  <b>{{ nextScoutRankAt ?? 'MAX' }}</b>
                </div>
              </div>
            </div>
            <span class="chip" data-testid="topbar-scout-chip"
              >Scout: <b>{{ scoutRankShort }}</b></span
            >
          </div>

          <div class="hero-divider"></div>

          <div class="chip-row">
            <span class="chip" data-testid="topbar-map-chip"
              >Location: <b>{{ heroLocation }}</b></span
            >
          </div>
        </section>

        <section v-else-if="activeTab === 'inventory'" class="tab-panel board-body">
          <div ref="boardFitWrapperRef" class="board-body-frame">
            <div
              ref="boardFitContentRef"
              class="board-body-content"
              :style="{
                transform: `translate(${boardFitOffsetX}px, ${boardFitOffsetY}px) scale(${boardFitScale})`,
              }"
            >
              <inventory-board-grid />
              <div
                class="center-layer"
                :style="{
                  width: `${boardFitContentWidth}px`,
                  height: `${boardFitContentHeight}px`,
                }"
              >
                <token-details-panel v-if="selectedItem" :item="selectedItem" />
                <hero-equip-board v-else />
              </div>
            </div>
          </div>
        </section>

        <section
          v-else-if="activeTab === 'events'"
          class="tab-panel events-tab"
          data-testid="events-tab-content"
        >
          <game-events-logger />
        </section>

        <footer v-if="activeTab === 'inventory'" class="board-bottom">
          <div class="hint" data-testid="inventory-hint">
            <span v-if="selectedItem">Click token again to close details</span>
            <span v-else>Pick items on map → tokens appear here</span>
          </div>
        </footer>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useFitToWidth } from '@/composables/use-fit-to-width';
import { isHeroBoardOpen, toggleHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import GameEventsLogger from '@/a-game-scenes/game-events-logger/components/game-events-logger.vue';
import HpHearts from '@/a-game-scenes/map-scene/components/hp-hearts.vue';
import DefenceShields from '@/a-game-scenes/map-scene/components/defence-shields.vue';
import InventoryBoardGrid from '@/a-game-scenes/inventory-scene/components/inventory-board-grid.vue';
import HeroEquipBoard from '@/a-game-scenes/inventory-scene/components/hero-equip-board.vue';
import TokenDetailsPanel from '@/a-game-scenes/inventory-scene/components/token-details-panel.vue';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { getScoutProgress } from '@hexoflat/engine/hero-movement/scout-progression';

type HeroBoardTab = 'hero' | 'inventory' | 'skills' | 'events';

const TABS: Array<{ id: HeroBoardTab; label: string; disabled?: boolean }> = [
  { id: 'hero', label: 'Hero' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'skills', label: 'Skills', disabled: true },
  { id: 'events', label: 'Events' },
];

const activeTab = ref<HeroBoardTab>('inventory');

const heroStore = useHeroStore();
const heroInventoryStore = useHeroInventoryStore();

const selectedItem = computed(() => heroInventoryStore.selectedItem);

const isStepsPopoverOpen = ref(false);

const heroName = computed(() => heroStore.hero?.name ?? 'Hero');
const heroSteps = computed(() => heroStore.hero?.heroSteps ?? 0);
const scoutProgress = computed(() => getScoutProgress(heroSteps.value));
const scoutMoveSteps = computed(() => scoutProgress.value.moveSteps);
const scoutRankLabel = computed(() => scoutProgress.value.rankLabel);
const nextScoutRankAt = computed(() => scoutProgress.value.nextRankAt);
const scoutRankShort = computed(() => `R${scoutProgress.value.current.rank}`);

const hpPercent = computed(() => {
  const max = Math.max(1, Number(heroStore.hero.maxHealth ?? 100) || 1);
  const val = Math.max(0, Math.min(max, Number(heroStore.hero.currentHealth ?? 0) || 0));
  return Math.round((val / max) * 100);
});

// Placeholder until a real defence stat exists on the hero model — shown
// fully filled rather than wired to any data source yet.
const defencePercent = computed(() => 100);

const heroLocation = computed(() => {
  const key = heroStore.nav.locationKey;
  if (!key) return 'Nowhere';

  return MapRegistry.get(key)?.title ?? key;
});

const {
  wrapperRef: boardFitWrapperRef,
  contentRef: boardFitContentRef,
  scale: boardFitScale,
  offsetX: boardFitOffsetX,
  offsetY: boardFitOffsetY,
  contentWidth: boardFitContentWidth,
  contentHeight: boardFitContentHeight,
} = useFitToWidth();

onMounted(() => {
  heroInventoryStore.hydrate();
});
</script>

<style scoped>
.hero-board-panel {
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  position: relative;

  background:
    radial-gradient(1200px 600px at 50% 30%, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0)),
    linear-gradient(180deg, rgba(20, 22, 28, 0.95), rgba(10, 11, 14, 0.98));
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.hero-board-rail {
  flex: none;
  width: 100%;
  max-width: 18px;
  height: 100%;

  display: grid;
  place-items: center;

  padding: 0;
  border: none;
  border-right: 1px solid rgba(190, 220, 255, 0.14);
  border-radius: 0;
  background: rgba(10, 12, 16, 0.85);
  color: rgba(230, 245, 255, 0.9);
  box-shadow: none;
  cursor: pointer;
}

.hero-board-rail:hover {
  background: rgba(20, 24, 30, 0.95);
}

.hero-board-rail__chevron {
  font-size: 20px;
  line-height: 1;
}

.hero-board-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hero-board-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

.board-top {
  padding: 0;
}

.tabs {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;

  padding: 0;
  border-radius: 0;

  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tab {
  width: 100%;
  height: 44px;

  border-radius: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);

  background: rgba(255, 0, 120, 0.14);
  color: rgba(255, 255, 255, 0.9);

  font-weight: 1000;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 11px;
}

.tab.is-active {
  background: rgba(255, 0, 120, 0.3);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.tab.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tab-panel {
  min-height: 0;
  padding: 16px 14px;
  overflow: auto;
}

.board-body {
  position: relative;
  overflow: hidden;
  padding: 0;
}

.board-body-frame {
  position: relative;
  width: 100%;
  height: 100%;
}

.board-body-content {
  position: absolute;
  inset: 0;
  transform-origin: top left;
}

.center-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.center-layer > * {
  pointer-events: auto;
}

.center-layer :deep(.equip-root),
.center-layer :deep(.token-details-root) {
  max-width: 100%;
  max-height: 100%;
}

.board-bottom {
  padding: 0;
  display: flex;
  justify-content: center;
}

.hint {
  width: 100%;
  padding: 4px 10px;
  border-radius: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: none;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  font-size: 10px;
  text-align: center;
}

.hero-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hero-badge__name {
  align-self: center;
  font-family: var(--font-main, serif), serif;
  font-weight: 700;
  font-size: 1.8rem;
  letter-spacing: 0.04em;
  color: rgba(232, 242, 255, 0.92);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 80px;
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

  font-size: 0.9rem;
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
  min-width: 240px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(8, 11, 16, 0.96);
  border: 1px solid rgba(190, 220, 255, 0.18);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
  z-index: 30;
}

.chip--with-popover:hover .chip-popover,
.chip--with-popover:focus-within .chip-popover,
.chip--with-popover.chip--popover-open .chip-popover {
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

.hero-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(190, 220, 255, 0.25), transparent);
}

.section-label {
  flex: none;
  align-self: center;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(190, 220, 255, 0.75);
}

.faith-section,
.hp-section {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 10px;
  height: 80px;
}

.faith-section .faith-bar,
.hp-section :deep(.icon-row) {
  flex: 1;
}

.faith-bar {
  align-self: center;
  display: flex;
  width: 100%;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.faith-bar__half {
  flex: 1;
}

.faith-bar__half--good {
  background: rgba(150, 200, 255, 0.35);
  box-shadow:
    inset 0 0 14px rgba(180, 220, 255, 0.9),
    0 0 12px rgba(150, 200, 255, 0.55);
}

.faith-bar__half--evil {
  background: rgba(120, 40, 170, 0.35);
  box-shadow:
    inset 0 0 14px rgba(170, 70, 230, 0.9),
    0 0 12px rgba(140, 50, 200, 0.55);
}
</style>
