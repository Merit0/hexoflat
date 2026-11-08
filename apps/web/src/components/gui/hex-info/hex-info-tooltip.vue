<template>
  <Teleport to="body">
    <transition name="hex-info">
      <div
        v-if="view && target"
        :key="view.key + '-' + hoveredKey"
        ref="el"
        class="hex-info"
        :class="{ 'is-above': above }"
        :style="layerStyle"
        data-testid="hex-info-tooltip"
      >
        <div class="hex-info__frame">
          <div class="hex-info__body">
            <span
              v-if="view.icon"
              class="hex-info__badge is-top"
              data-testid="hex-info-icon"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24"><path :d="ICON_PATHS[view.icon]" /></svg>
            </span>
            <span v-else class="hex-info__gem is-top" aria-hidden="true" />
            <hex-info-card :view="view" />
            <span
              v-if="view.rarity"
              class="hex-info__rarity is-bottom"
              :style="{ '--rarity': view.rarity.color }"
              data-testid="hex-info-rarity"
              :data-rarity-tone="view.rarity.tone"
              >{{ view.rarity.label }}</span
            >
            <span v-else class="hex-info__gem is-bottom" aria-hidden="true" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { buildHexInfo } from '@/services/hex-info/build-hex-info';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import HexInfoCard from './hex-info-card.vue';

const WIDTH_PX = 190;
const EDGE_PX = 8;
const GAP_PX = 6;

const i18n = useI18n();
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {});
const te = (key: string) => i18n.te(key);
const worldStore = useWorldMapStore();
const battleStore = useBattleStore();
const heroToolStore = useHeroToolStore();
const { target } = useHexHoverInfo();

const hoveredKey = computed(() => {
  const coordinates = target.value?.coordinates;
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : null;
});

const view = computed(() => {
  const key = hoveredKey.value;
  if (!key || battleStore.isOpen || heroToolStore.isDragging || knowledgePanelMode.value) {
    return null;
  }
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  const tile = worldStore.map?.tiles.find(
    (candidate) =>
      candidate.coordinates.columnIndex === columnIndex &&
      candidate.coordinates.rowIndex === rowIndex,
  );
  if (!tile?.isRevealed || !tile.hexobject) return null;
  return buildHexInfo(tile.hexobject, t(`itemTooltip.group.${tile.hexobject.groupType}`), t, te);
});

const el = ref<HTMLElement | null>(null);
const height = ref(0);
let observer: ResizeObserver | null = null;

watch(
  el,
  (node) => {
    observer?.disconnect();
    if (!node) {
      height.value = 0;
      return;
    }
    height.value = node.offsetHeight;
    observer = new ResizeObserver(() => {
      height.value = el.value?.offsetHeight ?? 0;
    });
    observer.observe(node);
  },
  { flush: 'post' },
);

onBeforeUnmount(() => observer?.disconnect());

const above = computed(() => (target.value?.anchor.top ?? 0) - GAP_PX - height.value >= EDGE_PX);

const layerStyle = computed(() => {
  const anchor = target.value?.anchor;
  const half = WIDTH_PX / 2 + EDGE_PX;
  const centerX = Math.min(Math.max(anchor?.centerX ?? 0, half), window.innerWidth - half);
  return {
    left: `${centerX}px`,
    top: `${above.value ? (anchor?.top ?? 0) - GAP_PX : (anchor?.bottom ?? 0) + GAP_PX}px`,
    visibility: height.value > 0 ? ('visible' as const) : ('hidden' as const),
    '--accent': view.value?.accent ?? '#d1a35f',
  };
});
</script>

<style scoped>
.hex-info {
  --body: #14120e;
  --ink: #e8e0cf;
  --muted: #a39886;
  --flavor: #bfa77c;
  position: fixed;
  z-index: 10000;
  --peak: 26px;
  --cut: 14px;
  --clip: polygon(
    0 calc(var(--peak) + var(--cut)),
    var(--cut) var(--peak),
    calc(50% - 36px) var(--peak),
    50% 0,
    calc(50% + 36px) var(--peak),
    calc(100% - var(--cut)) var(--peak),
    100% calc(var(--peak) + var(--cut)),
    100% calc(100% - var(--peak) - var(--cut)),
    calc(100% - var(--cut)) calc(100% - var(--peak)),
    calc(50% + 36px) calc(100% - var(--peak)),
    50% 100%,
    calc(50% - 36px) calc(100% - var(--peak)),
    var(--cut) calc(100% - var(--peak)),
    0 calc(100% - var(--peak) - var(--cut))
  );
  width: 190px;
  color: var(--ink);
  font-family: 'Alegreya Sans', var(--font-main, serif), sans-serif;
  pointer-events: none;
  filter: drop-shadow(0 14px 26px rgba(0, 0, 0, 0.65))
    drop-shadow(0 0 14px color-mix(in srgb, var(--accent) 22%, transparent));
}
.hex-info {
  transform: translateX(-50%);
}
.hex-info.is-above {
  transform: translate(-50%, -100%);
}
.hex-info__frame {
  padding: 3px;
  background: linear-gradient(160deg, #f0b95c, #8a5a22 45%, #e2a850 70%, #6e4619);
  clip-path: var(--clip);
}
.hex-info__body {
  position: relative;
  padding: 44px 12px 44px;
  background: linear-gradient(180deg, #1c1813, #12100c 60%, #15120e);
  clip-path: var(--clip);
}
.hex-info__gem {
  position: absolute;
  left: 50%;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #bdeaff, #2a9ae8 45%, #0b4f9a);
  border: 2px solid #e8b865;
  box-shadow: 0 0 10px rgba(80, 180, 255, 0.8);
  transform: translateX(-50%) rotate(45deg);
}
.hex-info__gem.is-top {
  top: 12px;
}
.hex-info__gem.is-bottom {
  bottom: 12px;
}
.hex-info__badge,
.hex-info__rarity {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.hex-info__badge {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #f4d9a0;
}
.hex-info__badge.is-top {
  top: 8px;
}
.hex-info__badge svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.hex-info__rarity {
  max-width: 120px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--rarity);
  text-shadow: 0 0 8px color-mix(in srgb, var(--rarity) 55%, transparent);
}
.hex-info__rarity.is-bottom {
  bottom: 14px;
}
.hex-info-enter-active {
  transition:
    opacity 140ms ease,
    scale 140ms ease;
}
.hex-info-leave-active {
  transition: opacity 80ms ease;
}
.hex-info-enter-from {
  opacity: 0;
  scale: 0.96;
}
.hex-info-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .hex-info-enter-active,
  .hex-info-leave-active,
  .hex-info__bar-fill {
    transition: none;
  }
}
</style>
