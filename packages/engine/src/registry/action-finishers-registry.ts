import { EHexActionType } from '../enums/hex-action-type';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IPendingTileAction } from '../abstraction/hex-tile-abstraction';
import { IActionContext } from '../abstraction/abstract-action';
import { getMeta } from '../content';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from './hexobjects-registry';

export type ActionFinisher = (
  tile: HexTileModel,
  action: IPendingTileAction,
  ctx: IActionContext,
) => boolean;

function ensureUnlocked(ctx: IActionContext) {
  if (ctx.heroToolStore?.isLocked) ctx.heroToolStore.unlockTool();
}

function handleCancelled(action: IPendingTileAction, ctx: IActionContext) {
  if (!action.cancelled) return false;
  ensureUnlocked(ctx);
  return true;
}

function logAction(ctx: IActionContext, message: string) {
  const heroName = ctx.hero.hero?.name ?? 'Hero';
  ctx.events.push(heroName, message, 'ACTION');
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

    ctx.gathering.add(action.hexobjectKey, 1);
    logAction(ctx, 'Cut the Tree');

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

    const meta = getMeta(action.hexobjectKey);
    const stone = meta?.yields?.stone ?? 0;
    logAction(ctx, `Mine the ${stone} ${tile.hexobject?.hexobjectKey ?? action.hexobjectKey}`);
    ctx.gathering.add(action.hexobjectKey, stone);

    if (stone > 0 && ctx.heroToolStore.stoneCollected) {
      ctx.heroToolStore.collectStones?.(stone);
    }

    scheduleRespawn(tile, ctx.now);
    ensureUnlocked(ctx);
    return true;
  },

  [EHexActionType.TAKE]: (tile, action, ctx) => {
    if (handleCancelled(action, ctx)) return true;

    const hexobject = tile.hexobject;
    if (!hexobject) {
      ensureUnlocked(ctx);
      return false;
    }

    const amount =
      hexobject.groupType === EHexobjectGroup.RESOURCE ? (hexobject.resource?.amount ?? 1) : 1;

    const result = ctx.inventory.putToInventory(hexobject.hexobjectKey, amount);

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

    const heal = getMeta(action.hexobjectKey)?.heal;

    if (heal) {
      const heroStore = ctx.hero;
      const healAmount = Math.max(0, Number(action.meta?.healAmount ?? 0));

      if (healAmount > 0) {
        heroStore.healHero(healAmount);
        logAction(ctx, 'Recovered while resting');
      }

      const heroIsStillResting =
        ctx.heroToolStore.isDragging &&
        ctx.heroToolStore.activeTool === HEXOBJECT_KEYS.HAND &&
        ctx.heroToolStore.hover?.columnIndex === tile.coordinates.columnIndex &&
        ctx.heroToolStore.hover?.rowIndex === tile.coordinates.rowIndex;

      const hasMoreHealthToRecover =
        (heroStore.hero.currentHealth ?? 0) < (heroStore.hero.maxHealth ?? 100);

      if (heroIsStillResting && hasMoreHealthToRecover) {
        const nextEndsAt = ctx.now + 10_000;

        tile.pendingAction = {
          type: EHexActionType.USE,
          startedAt: ctx.now,
          endsAt: nextEndsAt,
          hexobjectKey: action.hexobjectKey,
          cancelled: false,
          meta: { healAmount: heal.amountPerTick },
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
