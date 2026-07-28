<template>
  <div class="tool-hex-pos" :style="posStyle" data-testid="tool-hex-tile">
    <div class="tool-hex-tile" :class="{ doing: isWorking }" :style="toolStyle">
      <div v-if="!isWorking" class="tool-actions-row">
        <button
          v-if="bestActionLabel"
          class="do-btn"
          data-testid="tool-action-button"
          @click.stop="executeAction"
        >
          {{ bestActionLabel }}
        </button>

        <button v-else class="hide-btn" data-testid="tool-hide-button" @click.stop="emit('hide')">
          -
        </button>
      </div>

      <div v-if="isWorking" class="time-chip label" data-testid="tool-working-timer">
        {{ secondsLeft }}s
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { calcHexPixelPosition } from '@/utils/hex-utils';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  getToolCapabilities,
  resolveActions,
  type ResolvedAction,
} from '@/game-resolvers/interactions-resolver';
import { useWorldMapStore } from '@/stores/world-map-store';
import { ACTION_TYPE_MAP } from '@/registry/action-starters-registry';
import { ExecuteHexActionFeature } from '@/features/execute-hex-action-feature';
import { HexTileModel } from '@/a-game-scenes/map-scene/models/hex-tile-model';
import { getPrototype, getMeta } from '@/content';
import { HEXOBJECT_KEYS } from '@/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { EHexobjectGroup } from '@/abstraction/hexobject-abstraction';
import { THeroToolKey } from '@/content/equipment.content';

const props = defineProps<{
  tileWidth: number;
  // tool: HeroToolType; removed
}>();

const emit = defineEmits<{
  (e: 'hide'): void;
}>();

const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();
const heroStore = useHeroStore();

const activeToolKey = computed<THeroToolKey | null>(() => heroToolStore.activeTool);

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
        t.coordinates.columnIndex === c.columnIndex && t.coordinates.rowIndex === c.rowIndex,
    ) as HexTileModel | undefined) ?? null
  );
});

/** ---------------------------
 *  Position style
 *  -------------------------- */
const posStyle = computed(() => {
  if (!heroToolStore.hover) return { display: 'none' } as Record<string, string>;

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
  const toolHexImagePath = getPrototype(key).spritePath;

  return {
    backgroundImage: `url(${toolHexImagePath})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  } as Record<string, string>;
});

/** ---------------------------
 *  Resolve actions (no side effects in computed)
 *  -------------------------- */

const resolvedActions = computed(() => {
  const tile = hoveredTile.value;
  if (
    worldMapStore.combatActive &&
    worldMapStore.combatTurnSide === 'hero' &&
    !worldMapStore.isEnemyTurnResolving &&
    !worldMapStore.isHeroMoving &&
    heroToolStore.hover &&
    activeToolKey.value
  ) {
    const capabilities = getToolCapabilities(activeToolKey.value);

    if (
      capabilities.canBlock &&
      worldMapStore.combatAttackUsed &&
      !worldMapStore.combatDefendUsed &&
      worldMapStore.canPlaceCombatDefendMarker(heroToolStore.hover)
    ) {
      return [
        {
          actioType: 'BLOCK',
          label: 'Block',
          priority: 110,
        } satisfies ResolvedAction,
      ];
    }
  }

  if (!tile?.hexobject || !activeToolKey.value) return [];

  if (tile.hexobject.groupType === EHexobjectGroup.CONSTRUCTION) {
    const enterCfg = getMeta(tile.hexobject.hexobjectKey)?.enter;
    if (
      !tile.hexobject.isInteractable ||
      (enterCfg?.type === 'WORLD' && worldMapStore.isLocationRespawning(enterCfg.locationKey))
    ) {
      return [];
    }
  }

  if (
    worldMapStore.combatActive &&
    tile.hexobject.groupType === 'creature' &&
    (worldMapStore.combatTurnSide !== 'hero' ||
      worldMapStore.combatAttackUsed ||
      !activeToolKey.value ||
      !getToolCapabilities(activeToolKey.value).canAttack)
  ) {
    return [];
  }

  return resolveActions(activeToolKey.value, tile.hexobject);
});

const bestAction = computed<ResolvedAction | null>(() => {
  const actions = resolvedActions.value;
  if (!actions.length) return null;

  return actions.reduce<ResolvedAction | null>(
    (best, a) => (!best || a.priority > best.priority ? a : best),
    null,
  );
});

const bestActionLabel = computed(() => bestAction.value?.label ?? null);

// update store in watch (clean)
watch(
  resolvedActions,
  (actions) => {
    heroToolStore.setResolvedActions(actions);
  },
  { immediate: true },
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
  { immediate: true },
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

  if (a.type === 'USE' && a.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE) {
    const maxHp = Math.max(1, Number(heroStore.hero.maxHealth ?? 1));
    const currentHp = Math.max(0, Math.min(maxHp, Number(heroStore.hero.currentHealth ?? 0)));
    const missingHp = Math.max(0, maxHp - currentHp);
    const currentCycleSeconds = Math.ceil(Math.max(0, a.endsAt - now.value) / 1000);

    if (missingHp <= 1) {
      return currentCycleSeconds;
    }

    return currentCycleSeconds + (missingHp - 1) * 10;
  }

  return Math.ceil(Math.max(0, a.endsAt - now.value) / 1000);
});

/** ---------------------------
 *  Execute action
 *  -------------------------- */
function executeAction() {
  const tile = hoveredTile.value;
  const best = bestAction.value;
  if (!tile || !best || !activeToolKey.value) return;

  const actionType = ACTION_TYPE_MAP[best.actioType];
  if (!actionType) return;

  const res = new ExecuteHexActionFeature(tile).execute(actionType, activeToolKey.value);

  if (res.ok) {
    if (actionType === 'BLOCK') {
      heroToolStore.stopTool();
    }
    worldMapStore.saveToStorage();
  }
}
</script>

<style scoped>
.tool-hex-tile {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);

  clip-path: var(--hex-clip-path);

  z-index: 120;
  pointer-events: auto;

  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.2),
    0 12px 28px rgba(0, 0, 0, 0.55);
}

/* tool skins */
.tool-hex-tile.hand {
  background: url('/hex-assets/hex-tools/hand-hex-image.png') center/cover no-repeat;
}

.tool-hex-tile.axe {
  background: url('/hex-assets/hex-tools/axe-hex-image.png') center/cover no-repeat;
}

.tool-hex-tile.pickaxe {
  background: url('/hex-assets/hex-tools/pickaxe-token-image.png') center/cover no-repeat;
}

/* buttons */
.hide-btn {
  width: 18px;
  min-width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 999px;

  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.24);

  transition:
    transform 120ms ease,
    background 120ms ease,
    filter 120ms ease;
}

.hide-btn:hover {
  filter: brightness(1.15);
  background: rgba(0, 0, 0, 0.7);
}

.hide-btn:active {
  transform: scale(0.96);
}

.do-btn {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #f2e9d3;
  font-weight: 900;
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.12em;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.28);
}

.do-btn:hover {
  filter: brightness(1.15);
}

.do-btn:active {
  transform: scale(0.98);
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

.tool-actions-row {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(var(--hex-tile-width) * 0.72);
  max-width: calc(var(--hex-tile-width) * 0.72);
  z-index: 2;
  pointer-events: auto;
}

/* working anim */
.tool-hex-tile.doing {
  animation: tool-chop 220ms ease-in-out infinite;
  scale: 0.7;
}

@keyframes tool-chop {
  0% {
    transform: rotate(-6deg) scale(1.02);
  }
  50% {
    transform: rotate(7deg) scale(1.04);
  }
  100% {
    transform: rotate(-6deg) scale(1.02);
  }
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
