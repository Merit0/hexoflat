import { CONTENT_VERSION } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { deserializeWorld, type ServerWorld } from '@hexoflat/engine/world/server-world';
import { applyTileDiffs } from '@hexoflat/engine/world/tile-diff';
import { healthCapOf } from '@hexoflat/engine/utils/combat/health-format';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type { WorldClientHint } from '@hexoflat/engine/world/server-ports';
import {
  ensurePresence,
  sendWorldCommand,
  sendWorldStep,
  type WorldCommandResult,
} from '@/services/inventory/inventory-sync';
import {
  cachedWorldJson,
  dropPendingPushesOf,
  forgetServerWorld,
  queueWorldPush,
  rememberServerWorld,
} from '@/services/player/world-sync';
import { createServerWorld, serializeWorld } from '@hexoflat/engine/world/server-world';

export function readCachedWorld(locationKey: LocationKey): ServerWorld | null {
  const json = cachedWorldJson(locationKey);
  if (!json) return null;
  try {
    return deserializeWorld(JSON.parse(json), Date.now());
  } catch {
    forgetServerWorld(locationKey);
    return null;
  }
}

export interface ServedWorldView {
  locationKey: LocationKey;
  mapId: string;
  map: HexMapModel;
  descriptor: BoardDescriptor | null;
  heroCoordinates: IHexCoordinates | null;
  worldSeed: string | null;
  engagement: Engagement | null;
}

export function serverWorldJson(view: ServedWorldView): string {
  return JSON.stringify({
    contentVersion: CONTENT_VERSION,
    locationKey: view.locationKey,
    mapId: view.mapId,
    map: view.map,
    descriptor: view.descriptor,
    heroCoordinates: view.heroCoordinates,
    worldSeed: view.worldSeed ?? 'local',
    engagement: view.engagement,
  });
}

export interface ServerStepOutcome {
  ok: boolean;
  code?: string;
  ambush: Engagement | null;
  changed: IHexCoordinates[];
}

export async function stepOnServerWorld(
  at: { locationKey: LocationKey; mapId: string; from: IHexCoordinates; map: HexMapModel },
  target: IHexCoordinates,
): Promise<ServerStepOutcome> {
  await ensurePresence({
    locationKey: at.locationKey,
    mapId: at.mapId,
    coordinates: { ...at.from },
  });
  const result = await sendWorldStep(target);
  if (!result.ok) return { ok: false, code: result.code, ambush: null, changed: [] };
  const changed = applyTileDiffs(at.map, result.tileDiffs, Date.now());
  const ambushed = result.events.some((event) => event.type === 'AMBUSH');
  return { ok: true, ambush: ambushed ? result.engagement : null, changed };
}

export interface ReplayDeps {
  tool: {
    activeTool: THeroToolKey | null;
    lockTool(tile: HexTileModel, endsAt: number): void;
    unlockTool(): void;
    consumeDurability(pct: number): boolean;
    stopTool(): void;
    clearResolvedActions(): void;
    addTreeCut(amount: number): void;
    collectStones(amount: number): void;
  };
  gathering: { add(key: THexobjectKey, amount: number): void };
  events: { push(source: string, text: string, type?: 'ACTION'): void };
  hero: { healHero(amount: number): void; hero: { name: string } };
  tileAt(coordinates: IHexCoordinates): HexTileModel | null;
}

export function replayEffects(effects: WorldCommandResult['effects'], deps: ReplayDeps): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'lockTool': {
        const tile = deps.tileAt(effect.coordinates);
        if (tile) deps.tool.lockTool(tile, effect.endsAt);
        break;
      }
      case 'unlockTool':
        deps.tool.unlockTool();
        break;
      case 'consumeDurability':
        deps.tool.consumeDurability(effect.pct);
        break;
      case 'stopTool':
        deps.tool.stopTool();
        break;
      case 'clearResolvedActions':
        deps.tool.clearResolvedActions();
        break;
      case 'setActiveTool':
        deps.tool.activeTool = effect.key;
        break;
      case 'treeCut':
        deps.tool.addTreeCut(effect.amount);
        break;
      case 'stones':
        deps.tool.collectStones(effect.amount);
        break;
      case 'gather':
        deps.gathering.add(effect.key, effect.amount);
        break;
      case 'log':
        deps.events.push(effect.source || deps.hero.hero.name || 'Hero', effect.text, 'ACTION');
        break;
      case 'heal':
        deps.hero.healHero(effect.amount);
        break;
    }
  }
}

export function applyWorldResult(
  map: HexMapModel,
  result: WorldCommandResult,
  deps: ReplayDeps,
): IHexCoordinates[] {
  const changed = applyTileDiffs(map, result.tileDiffs, Date.now());
  replayEffects(result.effects, deps);
  return changed;
}

export function buildClientHint(
  tool: {
    isDragging: boolean;
    hover: IHexCoordinates | null;
    activeTool: THeroToolKey | null;
    durability: number;
    durabilityMax: number;
  },
  hero: { currentHealth: number; maxHealth: number },
): WorldClientHint {
  return {
    tool: {
      dragging: tool.isDragging,
      hover: tool.hover
        ? { columnIndex: tool.hover.columnIndex, rowIndex: tool.hover.rowIndex }
        : null,
      active: tool.activeTool,
      durability: { current: tool.durability, max: tool.durabilityMax },
    },
    health: { current: hero.currentHealth, max: healthCapOf(hero) },
  };
}

export function hasDueWork(map: HexMapModel, now: number): boolean {
  return map.tiles.some(
    (tile) =>
      (tile.pendingAction !== null && tile.pendingAction.endsAt <= now) ||
      (!tile.hexobject &&
        !!tile.resourceSpawner?.enabled &&
        typeof tile.resourceSpawner.nextSpawnAt === 'number' &&
        tile.resourceSpawner.nextSpawnAt <= now),
  );
}

export async function tickServerWorld(
  at: { locationKey: LocationKey; mapId: string; from: IHexCoordinates },
  client: WorldClientHint,
): Promise<WorldCommandResult> {
  await ensurePresence({ locationKey: at.locationKey, mapId: at.mapId, coordinates: at.from });
  return sendWorldCommand('WORLD_TICK', { client });
}

export async function actOnServerWorld(
  at: { locationKey: LocationKey; mapId: string; from: IHexCoordinates },
  action: { coordinates: IHexCoordinates; actionType: string; toolKey: string },
  client: WorldClientHint,
): Promise<WorldCommandResult> {
  await ensurePresence({ locationKey: at.locationKey, mapId: at.mapId, coordinates: at.from });
  return sendWorldCommand('WORLD_ACTION', {
    coordinates: {
      columnIndex: action.coordinates.columnIndex,
      rowIndex: action.coordinates.rowIndex,
    },
    actionType: action.actionType,
    toolKey: action.toolKey,
    client,
  });
}

export function queueFreshServedWorld(locationKey: LocationKey, heroId: string): void {
  const fresh = createServerWorld(locationKey, crypto.randomUUID(), crypto.randomUUID(), heroId);
  const json = JSON.stringify(serializeWorld(fresh));
  queueWorldPush(locationKey, fresh.mapId, json);
}

export async function travelOnServer(
  at: { locationKey: LocationKey; mapId: string; from: IHexCoordinates },
  via: { kind: 'exit' } | { kind: 'gate'; coordinates: IHexCoordinates },
): Promise<WorldCommandResult> {
  await ensurePresence({ locationKey: at.locationKey, mapId: at.mapId, coordinates: at.from });
  const body =
    via.kind === 'exit'
      ? via
      : {
          kind: 'gate',
          coordinates: {
            columnIndex: via.coordinates.columnIndex,
            rowIndex: via.coordinates.rowIndex,
          },
        };
  return sendWorldCommand('WORLD_TRAVEL', { via: body });
}

export function installTravelledWorlds(result: WorldCommandResult): LocationKey | null {
  const { travel } = result;
  if (!result.ok || !travel) return null;
  for (const entry of [travel, travel.refreshed]) {
    if (!entry) continue;
    const world = entry.world as { mapId: string };
    dropPendingPushesOf(entry.locationKey);
    rememberServerWorld(entry.locationKey, world.mapId, JSON.stringify(entry.world));
  }
  return travel.locationKey as LocationKey;
}
