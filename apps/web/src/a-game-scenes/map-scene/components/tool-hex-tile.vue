<template>
  <tool-hex-anchor
    v-slot="{ flipped }"
    :at="anchor"
    :origin="heroToolStore.origin"
    :tile-width="tileWidth"
    :tile-height="tileHeight"
    data-testid="tool-hex-tile"
  >
    <tool-hex-face
      :icon-path="toolIconPath"
      :flipped="flipped"
      :working="isWorking"
      :label="bestActionLabel"
      :read="isReadAction"
      :denied="denied"
      :can-afford="canAffordBest"
      @act="executeAction"
      @hide="emit('hide')"
    />
    <div v-if="isWorking && !isReading" class="time-chip label" data-testid="tool-working-timer">
      {{ secondsLeft }}s
    </div>
  </tool-hex-anchor>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import ToolHexFace from '@/components/gui/tool-hex/tool-hex-face.vue';
import ToolHexAnchor from '@/components/gui/tool-hex/tool-hex-anchor.vue';
import { openKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useWillPricing } from '@/composables/use-will-pricing';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  resolveActions,
  type ResolvedAction,
} from '@hexoflat/engine/game-resolvers/interactions-resolver';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { ACTION_TYPE_MAP } from '@hexoflat/engine/registry/action-starters-registry';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { getPrototype, getMeta } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { toolKeyOfItem } from '@/composables/hand-tools';
import { useBookReading } from '@/composables/use-book-reading';
import { usePortal } from '@/composables/use-portal';
import { portalRefusalText } from '@/composables/use-portal-messages';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { applySquadEvents } from '@/services/squads/squad-flow';
import { asSquad } from '@hexoflat/engine/squads/squad-state';

defineProps<{
  tileWidth: number;
  tileHeight: number;
}>();

const emit = defineEmits<{
  (e: 'hide'): void;
}>();

const i18n = useI18n();
const { t } = i18n;
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();
const battleStore = useBattleStore();
const heroStore = useHeroStore();
const pricing = useWillPricing();
const portal = usePortal();

const activeToolKey = computed<THeroToolKey | null>(() => heroToolStore.activeTool);

const hoveredTile = computed<HexTileModel | null>(() => {
  const c = heroToolStore.hover;
  const map = worldMapStore.map;
  if (!c || !map) return null;

  const tiles = map.tiles as HexTileModel[];
  return (
    tiles.find(
      (t: HexTileModel) =>
        t.coordinates.columnIndex === c.columnIndex && t.coordinates.rowIndex === c.rowIndex,
    ) ?? null
  );
});

const { isReading, anchor } = useBookReading(activeToolKey);

const toolIconPath = computed(
  () => getPrototype(activeToolKey.value ?? HEXOBJECT_KEYS.HAND).spritePath ?? '',
);

const isScrollTool = computed(() => activeToolKey.value === HEXOBJECT_KEYS.RETURN_SCROLL);

function actionsForTool(tool: THeroToolKey, tile: HexTileModel | null): ResolvedAction[] {
  if (tool === HEXOBJECT_KEYS.RETURN_SCROLL) {
    const preview = tile ? portal.previewOpen(tile.coordinates) : null;
    const offersUse =
      !!preview &&
      (preview.ok || preview.reason === 'INSUFFICIENT_WILL' || preview.reason === 'NOT_AN_ANGEL');
    return offersUse
      ? [{ actioType: 'USE', label: t('tool.use'), priority: 100 } satisfies ResolvedAction]
      : [];
  }

  if (!tile?.hexobject) return [];

  if (tile.hexobject.groupType === EHexobjectGroup.CONSTRUCTION) {
    const enterCfg = getMeta(tile.hexobject.hexobjectKey)?.enter;
    if (
      !tile.hexobject.isInteractable ||
      (enterCfg?.type === 'WORLD' && worldMapStore.isLocationRespawning(enterCfg.locationKey))
    ) {
      return [];
    }
  }

  return resolveActions(tool, tile.hexobject);
}

const inventoryStore = useHeroInventoryStore();

const handTools = computed(() => {
  const keys = (['weapon', 'shield'] as const)
    .map((slot) => toolKeyOfItem(inventoryStore.equippedItems[slot]?.key))
    .filter((key): key is THeroToolKey => key !== null);
  return [...new Set(keys)];
});

function topPriority(tool: THeroToolKey, tile: HexTileModel | null): number {
  return actionsForTool(tool, tile).reduce((best, action) => Math.max(best, action.priority), -1);
}

watch(
  () => [hoveredTile.value, handTools.value, heroToolStore.isDragging] as const,
  ([tile, tools, dragging]) => {
    const current = activeToolKey.value;
    if (!dragging || !tile || !current || battleStore.inBattle || heroToolStore.isLocked) return;

    let best = current;
    let bestPriority = topPriority(current, tile);
    for (const tool of tools) {
      const priority = topPriority(tool, tile);
      if (priority > bestPriority) {
        best = tool;
        bestPriority = priority;
      }
    }
    if (best !== current) heroToolStore.activeTool = best;
  },
  { immediate: true },
);

const portalPreview = computed(() => {
  const tile = hoveredTile.value;
  if (!isScrollTool.value || !tile) return null;
  return portal.previewOpen(tile.coordinates);
});

const resolvedActions = computed(() => {
  return activeToolKey.value ? actionsForTool(activeToolKey.value, hoveredTile.value) : [];
});

const bestAction = computed<ResolvedAction | null>(() => {
  const actions = resolvedActions.value;
  if (!actions.length) return null;

  return actions.reduce<ResolvedAction | null>(
    (best, a) => (!best || a.priority > best.priority ? a : best),
    null,
  );
});

const isReadAction = computed(
  () =>
    hoveredTile.value?.hexobject?.hexobjectKey === HEXOBJECT_KEYS.KNOWLEDGE_BOOK &&
    activeToolKey.value === HEXOBJECT_KEYS.HAND,
);
const bestActionLabel = computed(() => {
  if (!bestAction.value) return null;
  if (isScrollTool.value) return bestAction.value.label;
  const object = hoveredTile.value?.hexobject;
  if (isReadAction.value) return t('tool.read');
  const isHandOnBuilding =
    activeToolKey.value === HEXOBJECT_KEYS.HAND &&
    object?.groupType === EHexobjectGroup.CONSTRUCTION &&
    !getMeta(object.hexobjectKey)?.heal;
  if (bestAction.value.actioType === 'ENTER') return t('tool.enter');
  if (isHandOnBuilding) return t('tool.open');
  const label = bestAction.value.label;
  return i18n.te(label) ? t(label) : label;
});

const bestActionCost = computed(() =>
  isScrollTool.value
    ? (portalPreview.value?.cost ?? 0)
    : pricing.costOf(
        hoveredTile.value,
        bestAction.value ? ACTION_TYPE_MAP[bestAction.value.actioType] : undefined,
      ),
);
const canAffordBest = computed(() => pricing.canAfford(bestActionCost.value));

watch(
  resolvedActions,
  (actions) => {
    heroToolStore.setResolvedActions(actions);
  },
  { immediate: true },
);

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
  if (deniedTimer) window.clearTimeout(deniedTimer);
  if (timer) window.clearInterval(timer);
});

const isWorking = computed(() => {
  if (isReading.value) return true;
  const a = pendingAction.value;
  if (!a?.endsAt) return false;

  return now.value < a.endsAt;
});

const secondsLeft = computed(() => {
  const a = pendingAction.value;
  if (!a?.endsAt) return 0;

  if (a.type === EHexActionType.USE && a.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE) {
    const maxHp = Math.max(1, heroStore.heroHpMax);
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

const denied = ref(false);
let deniedTimer: number | null = null;
function flashDenied() {
  denied.value = true;
  if (deniedTimer) window.clearTimeout(deniedTimer);
  deniedTimer = window.setTimeout(() => (denied.value = false), 200);
}

async function executeAction() {
  const tile = hoveredTile.value;
  const best = bestAction.value;
  if (!tile || !best || !activeToolKey.value) return;
  if (!canAffordBest.value) {
    flashDenied();
    heroToolStore.setActionMessage(t('knowledge.insufficientWill'), 'will', bestActionCost.value);
    return;
  }

  if (isScrollTool.value) {
    const preview = portalPreview.value;
    const previewCost = preview?.cost ?? null;
    const oneWay = !!preview?.ok && preview.oneWay;
    const opened = await portal.openPortal(tile.coordinates);
    if (!opened.ok && opened.reason) {
      flashDenied();
      heroToolStore.setActionMessage(
        portalRefusalText(opened.reason),
        opened.reason === 'INSUFFICIENT_WILL' ? 'will' : null,
        opened.reason === 'INSUFFICIENT_WILL' ? previewCost : null,
      );
    } else if (opened.ok && oneWay) {
      heroToolStore.setActionMessage(t('portal.oneWay'));
    }
    return;
  }

  const actionType = ACTION_TYPE_MAP[best.actioType];
  if (!actionType) return;

  if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL) {
    const entered = await portal.enterPortal();
    if (!entered.ok && entered.reason) {
      flashDenied();
      heroToolStore.setActionMessage(portalRefusalText(entered.reason));
    }
    return;
  }

  if (tile.hexobject?.hexobjectKey === 'knowledge-book') {
    if (await heroStore.knowledgeAction({ kind: 'open' })) {
      openKnowledgePanel('hall');
    } else {
      flashDenied();
      heroToolStore.setActionMessage(t('moveBlocked.hallUnavailable'));
    }
    return;
  }

  const onSquad = !!asSquad(tile.hexobject);
  const res = await worldMapStore.executeHexAction(tile, actionType, activeToolKey.value);
  const squadRejection = onSquad ? applySquadEvents(res.events) : null;

  if (res.ok) {
    worldMapStore.saveToStorage();
  } else if (squadRejection ?? res.message) {
    flashDenied();
    heroToolStore.setActionMessage(squadRejection ?? res.message ?? '');
  }
}
</script>

<style scoped>
.time-chip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  transform-origin: center bottom;

  z-index: 121;
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
