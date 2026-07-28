import { EHexActionType } from '@/enums/hex-action-type';
import type { HexTileModel } from '@/a-game-scenes/map-scene/models/hex-tile-model';
import type { IPendingTileAction } from '@/abstraction/hex-tile-abstraction';
import { IActionContext } from '@/abstraction/abstract-action';
import { getMeta } from '@/content';
import { useGatheringStore } from '@/stores/gathering-store';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { EHexobjectGroup } from '@/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@/registry/hexobjects-registry';

export type ActionFinisher = (
  tile: HexTileModel,
  action: IPendingTileAction,
  ctx: IActionContext,
) => boolean;

function ensureUnlocked(ctx: IActionContext) {
  if (ctx.heroToolStore?.isLocked) (ctx.heroToolStore as any).unlockTool?.();
}

function handleCancelled(action: IPendingTileAction, ctx: IActionContext) {
  if (!action.cancelled) return false;
  ensureUnlocked(ctx);
  return true;
}

function getHeroName() {
  const heroStore = useHeroStore();
  return heroStore.hero?.name ?? 'Hero';
}

function logAction(message: string) {
  const gameEventsStore = useGameEventsStore();
  gameEventsStore.push(getHeroName(), message, 'ACTION');
}

function consumeTileHexobject(tile: HexTileModel) {
  tile.hexobject = null;
}

function scheduleRespawn(tile: HexTileModel, now: number) {
  if (!tile.resourceSpawner?.enabled) return;
  tile.resourceSpawner.nextSpawnAt = now + tile.resourceSpawner.regrowMs;
}

const FINISH_UNLOCK_ONLY: ActionFinisher = (_tile, _action, ctx) => {
  ensureUnlocked(ctx);
  return true;
};

export const ACTION_FINISHERS: Record<EHexActionType, ActionFinisher> = {
  [EHexActionType.CUT]: (tile, action, ctx) => {
    if (handleCancelled(action, ctx)) return true;

    const gathering = useGatheringStore();

    gathering.add(action.hexobjectKey, 1);
    logAction('Cut the Tree');

    consumeTileHexobject(tile);

    const meta = getMeta(action.hexobjectKey);
    const wood = meta?.yields?.wood ?? 0;
    if (wood > 0 && ctx.heroToolStore.addTreeCut) {
      ctx.heroToolStore.addTreeCut(wood);
    }

    scheduleRespawn(tile, ctx.now);
    ensureUnlocked(ctx);
    return true;
  },

  [EHexActionType.MINE]: (tile, action, ctx) => {
    if (handleCancelled(action, ctx)) return true;

    const gathering = useGatheringStore();
    const meta = getMeta(action.hexobjectKey);
    const stone = meta?.yields?.stone ?? 0;
    logAction(`Mine the ${stone} ${tile.hexobject.hexobjectKey}`);
    gathering.add(action.hexobjectKey, stone);

    if (stone > 0 && ctx.heroToolStore.stoneCollected) {
      ctx.heroToolStore.collectStones(stone);
    }

    scheduleRespawn(tile, ctx.now);
    ensureUnlocked(ctx);
    return true;
  },

  [EHexActionType.TAKE]: (tile, action, ctx) => {
    const heroInventory = useHeroInventoryStore();

    if (handleCancelled(action, ctx)) return true;

    const hexobject = tile.hexobject;
    if (!hexobject) {
      ensureUnlocked(ctx);
      return false;
    }

    const amount =
      hexobject.groupType === EHexobjectGroup.RESOURCE ? (hexobject.resource?.amount ?? 1) : 1;

    const result = heroInventory.putToInventory(hexobject.hexobjectKey, amount);

    if (!result?.ok) {
      ensureUnlocked(ctx);
      return false;
    }

    consumeTileHexobject(tile);
    if (hexobject.groupType === EHexobjectGroup.RESOURCE) {
      scheduleRespawn(tile, ctx.now);
    }
    ensureUnlocked(ctx);

    return true;
  },

  [EHexActionType.USE]: (tile, action, ctx) => {
    if (handleCancelled(action, ctx)) return true;

    if (action.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE) {
      const heroStore = useHeroStore();
      const healAmount = Math.max(0, Number(action.meta?.healAmount ?? 0));

      if (healAmount > 0) {
        heroStore.healHero(healAmount);
        logAction('Recovered by the fire');
      }

      const heroIsStillUsingFireplace =
        ctx.heroToolStore.isDragging &&
        ctx.heroToolStore.activeTool === HEXOBJECT_KEYS.HAND &&
        ctx.heroToolStore.hover?.columnIndex === tile.coordinates.columnIndex &&
        ctx.heroToolStore.hover?.rowIndex === tile.coordinates.rowIndex;

      const hasMoreHealthToRecover =
        (heroStore.hero.currentHealth ?? 0) < (heroStore.hero.maxHealth ?? 100);

      if (heroIsStillUsingFireplace && hasMoreHealthToRecover) {
        const nextEndsAt = ctx.now + 10_000;

        tile.pendingAction = {
          type: EHexActionType.USE,
          startedAt: ctx.now,
          endsAt: nextEndsAt,
          hexobjectKey: action.hexobjectKey,
          cancelled: false,
          meta: { healAmount: 1 },
        };

        ctx.heroToolStore.unlockTool();
        ctx.heroToolStore.lockTool(tile, nextEndsAt);
        return true;
      }
    }

    ensureUnlocked(ctx);
    return true;
  },

  [EHexActionType.OPEN]: FINISH_UNLOCK_ONLY,
  [EHexActionType.ENTER]: FINISH_UNLOCK_ONLY,
  [EHexActionType.ATTACK]: FINISH_UNLOCK_ONLY,
  [EHexActionType.BLOCK]: FINISH_UNLOCK_ONLY,
};
