<template>
  <div class="tool-hex-pos" :style="posStyle">
    <div class="tool-hex-tile" :class="[toolClass, { doing: isWorking }]">
      <button class="hide-btn" @click.stop="emit('hide')">HIDE</button>

      <button
          v-if="actionHint && !isWorking"
          class="do-btn"
          @click.stop="executeAction"
      >
        {{ actionHint }}
      </button>

      <div v-if="isWorking" class="time-chip label">{{ secondsLeft }}s</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import type {IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {calcHexPixelPosition} from "@/utils/tile-utils";
import {HeroToolType} from "@/enums/hero-tool-type";

import {useHeroToolStore} from "@/stores/hero-tool-store";
import {resolveActions} from "@/game-resolvers/interactions-resolver";
import {useWorldMapStore} from "@/stores/world-map-store";
import {ACTION_TYPE_MAP} from "@/registry/action-starters-registry";
import {ExecuteHexActionFeature} from "@/features/execute-hex-action-feature";
import {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";

const props = defineProps<{
  coord: IHexCoordinates | null;
  tileWidth: number;
  tool: HeroToolType;
}>();

const emit = defineEmits<{
  (e: "hide"): void;
}>();

const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

const isWorking = computed(() => {
  const tile = hoveredTile.value;
  const a = tile?.pendingAction;
  return !!a && a.type === "CUT" && now.value < a.endsAt;
});

const posStyle = computed(() => {
  if (!props.coord || !props.tool) return { display: "none" } as Record<string, string>;

  const pseudoTile = { coordinates: props.coord } as any;
  const { x, y } = calcHexPixelPosition(pseudoTile, props.tileWidth);

  const ix = Math.round(x);
  const iy = Math.round(y);

  return {
    transform: `translate(${ix}px, ${iy}px)`
  };
});

const hoveredTile = computed(() => {
  const c = props.coord;
  if (!c || !worldMapStore.map) return null;

  return (
      worldMapStore.map.tiles.find(
          (t: any) =>
              t.coordinates.columnIndex === c.columnIndex &&
              t.coordinates.rowIndex === c.rowIndex
      ) ?? null
  );
});

const actionHint = computed(() => {
  const tile = hoveredTile.value;
  if (!tile?.hexobject) return null;

  const tool: HeroToolType = props.tool ?? HeroToolType.HAND;
  const actions = resolveActions(tool, tile.hexobject);
  heroToolStore.setResolvedActions(actions);

  const best = actions.slice().sort((a, b) => b.priority - a.priority)[0];
  return best?.label ?? null;
});

// --- timer для countdown
const now = ref(Date.now());
let timer: number | null = null;

onMounted(() => {
  timer = window.setInterval(() => (now.value = Date.now()), 200);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});

const pendingAction = computed(() => hoveredTile.value?.pendingAction ?? null);

const secondsLeft = computed(() => {
  const a = pendingAction.value;
  if (!a) return 0;
  return Math.ceil(Math.max(0, a.endsAt - now.value) / 1000);
});

function executeAction() {
  const tile = hoveredTile.value as HexTileModel;
  if (!tile?.hexobject) return;

  const tool = props.tool;
  const actions = resolveActions(tool, tile.hexobject);
  const best = actions.slice().sort((a,b)=>b.priority-a.priority)[0];
  if (!best) return;

  const actionType = ACTION_TYPE_MAP[best.actioType];
  const res = new ExecuteHexActionFeature(tile).execute(actionType, tool, Date.now());

  if (res.ok) {
    worldMapStore.saveToStorage();
  }
}

const toolClass = computed(() => (props.tool === "axe" ? "axe" : "hand"));
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

.tool-hex-tile.hand {
  background-image: url("@/assets/hexs/terrain-hexs/hand-hex-image.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.tool-hex-tile.axe {
  background-image: url("@/assets/hexs/terrain-hexs/axe-hex-image.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

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

.action-chip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);

  padding: 6px 10px;
  border-radius: 999px;

  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.12em;

  pointer-events: none;
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

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 4px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.95);
  animation: spin 0.8s linear infinite;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.55));
}

.timer {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f2e9d3;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.12em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes tool-chop {
  0% {
    transform: translate(var(--tx), var(--ty)) rotate(-6deg) scale(1.02);
  }
  50% {
    transform: translate(var(--tx), var(--ty)) rotate(7deg) scale(1.04);
  }
  100% {
    transform: translate(var(--tx), var(--ty)) rotate(-6deg) scale(1.02);
  }
}

.tool-hex-pos{
  position:absolute;
  z-index:120;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  pointer-events: auto;

  transition: transform 120ms linear; /* linear краще за ease */
  will-change: transform;
  transform: translateZ(0);
}

.tool-hex-tile.doing{
  animation: tool-chop 220ms ease-in-out infinite;
  scale: 0.70;
}
@keyframes tool-chop{
  0%{ transform: rotate(-6deg) scale(1.02); }
  50%{ transform: rotate(7deg) scale(1.04); }
  100%{ transform: rotate(-6deg) scale(1.02); }
}

.time-chip{
  position:absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);

  min-width: 38px;
  text-align:center;

  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.62);
  border: 1px solid rgba(255,255,255,0.18);
  color: #f2e9d3;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.08em;
  pointer-events:none;
}
</style>