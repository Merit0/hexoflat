<template>
  <div class="tool-hex-pos" :style="posStyle">
    <div
        class="tool-hex-tile"
        :class="{ doing: isWorking }"
        :style="toolStyle"
    >
      <button class="hide-btn" @click.stop="emit('hide')">HIDE</button>

      <button
          v-if="bestActionLabel && !isWorking"
          class="do-btn"
          @click.stop="executeAction"
      >
        {{ bestActionLabel }}
      </button>

      <div v-if="isWorking" class="time-chip label">{{ secondsLeft }}s</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { calcHexPixelPosition } from "@/utils/hex-utils";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { resolveActions } from "@/game-resolvers/interactions-resolver";
import { useWorldMapStore } from "@/stores/world-map-store";
import { ACTION_TYPE_MAP } from "@/registry/action-starters-registry";
import { ExecuteHexActionFeature } from "@/features/execute-hex-action-feature";
import { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {TToolKeys} from "@/registry/hexobjects/prototypes/tools.prototypes";
import {HEX_OBJECT_PROTOTYPES} from "@/registry/hexobjects/prototypes";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

const props = defineProps<{
  tileWidth: number;
  // tool: HeroToolType; removed
}>();

const emit = defineEmits<{
  (e: "hide"): void;
}>();

const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

const activeToolKey = computed<TToolKeys>(() => heroToolStore.activeTool);

/** ---------------------------
 *  Tile lookup
 *  -------------------------- */
const hoveredTile = computed<HexTileModel | null>(() => {
  const c = heroToolStore.hover;
  const map = worldMapStore.map;
  if (!c || !map) return null;

  return (
      (map.tiles.find(
          (t: any) =>
              t.coordinates.columnIndex === c.columnIndex &&
              t.coordinates.rowIndex === c.rowIndex
      ) as HexTileModel | undefined) ?? null
  );
});

/** ---------------------------
 *  Position style
 *  -------------------------- */
const posStyle = computed(() => {
  if (!heroToolStore.hover) return { display: "none" } as Record<string, string>;

  const pseudoTile = { coordinates: heroToolStore.hover } as any;
  const { x, y } = calcHexPixelPosition(pseudoTile, props.tileWidth);

  return {
    transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)`,
  } as Record<string, string>;
});

/** ---------------------------
 *  Tool class (normalized)
 *  -------------------------- */
const toolStyle = computed(() => {

  const key = activeToolKey.value ?? HEXOBJECT_KEYS.HAND;
  const toolHexImagePath = HEX_OBJECT_PROTOTYPES[key].spritePath;

  return {
    backgroundImage: `url(${toolHexImagePath})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  } as Record<string, string>;
});

/** ---------------------------
 *  Resolve actions (no side effects in computed)
 *  -------------------------- */

const resolvedActions = computed(() => {
  const tile = hoveredTile.value;
  if (!tile?.hexobject) return [];
  return resolveActions(activeToolKey.value, tile.hexobject);
});

const bestAction = computed(() => {
  const actions = resolvedActions.value;
  if (!actions.length) return null;

  return actions.reduce((best, a) => (!best || a.priority > best.priority ? a : best), null as any);
});

const bestActionLabel = computed(() => bestAction.value?.label ?? null);

// update store in watch (clean)
watch(
    resolvedActions,
    (actions) => {
      heroToolStore.setResolvedActions(actions);
    },
    { immediate: true }
);

/** ---------------------------
 *  Pending action + working state
 *  -------------------------- */
const pendingAction = computed(() => hoveredTile.value?.pendingAction ?? null);

const now = ref(Date.now());
let timer: number | null = null;

watch(
    () => pendingAction.value?.endsAt ?? null,
    (endsAt) => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      if (!endsAt) return;

      timer = window.setInterval(() => (now.value = Date.now()), 200);
    },
    { immediate: true }
);

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});

const isWorking = computed(() => {
  const a = pendingAction.value;
  if (!a?.endsAt) return false;

  return now.value < a.endsAt;
});

const secondsLeft = computed(() => {
  const a = pendingAction.value;
  if (!a?.endsAt) return 0;
  return Math.ceil(Math.max(0, a.endsAt - now.value) / 1000);
});

/** ---------------------------
 *  Execute action
 *  -------------------------- */
function executeAction() {
  const tile = hoveredTile.value;
  const best = bestAction.value;
  if (!tile?.hexobject || !best) return;

  const actionType = ACTION_TYPE_MAP[best.actioType];
  if (!actionType) return;

  const res = new ExecuteHexActionFeature(tile).execute(actionType, activeToolKey.value);

  if (res.ok) {
    worldMapStore.saveToStorage();
  }
}
</script>

<style scoped>
.tool-hex-tile {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);

  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );

  z-index: 120;
  pointer-events: auto;

  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.20),
  0 12px 28px rgba(0, 0, 0, 0.55);
}

/* tool skins */
.tool-hex-tile.hand {
  background: url("/hex-assets/hex-tools/hand-hex-image.png") center/cover no-repeat;
}

.tool-hex-tile.axe {
  background: url("/hex-assets/hex-tools/axe-hex-image.png") center/cover no-repeat;
}

.tool-hex-tile.pickaxe {
  background: url("/hex-assets/hex-tools/pickaxe-token-image.png") center/cover no-repeat;
}

/* buttons */
.hide-btn {
  opacity: 0;
  pointer-events: none;

  width: 64px;
  height: 30px;
  border-radius: 10px;

  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.12em;

  transition: opacity 120ms ease, transform 120ms ease, background 120ms ease, filter 120ms ease;
}

.tool-hex-tile:hover .hide-btn {
  opacity: 1;
  pointer-events: auto;
}

.hide-btn:hover {
  filter: brightness(1.15);
  background: rgba(0, 0, 0, 0.7);
}

.hide-btn:active {
  transform: scale(0.96);
}

.do-btn {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  height: 34px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #f2e9d3;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.do-btn:hover {
  filter: brightness(1.15);
}

.do-btn:active {
  transform: translateX(-50%) scale(0.98);
}

/* pos wrapper */
.tool-hex-pos {
  position: absolute;
  z-index: 120;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  pointer-events: auto;

  transition: transform 120ms linear;
  will-change: transform;
  transform: translateZ(0);
}

/* working anim */
.tool-hex-tile.doing {
  animation: tool-chop 220ms ease-in-out infinite;
  scale: 0.70;
}

@keyframes tool-chop {
  0% { transform: rotate(-6deg) scale(1.02); }
  50% { transform: rotate(7deg) scale(1.04); }
  100% { transform: rotate(-6deg) scale(1.02); }
}

.time-chip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);

  min-width: 38px;
  text-align: center;

  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f2e9d3;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.08em;
  pointer-events: none;
}
</style>