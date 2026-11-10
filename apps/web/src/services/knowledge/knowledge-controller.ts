import type { HexEngineActionContext, HexEngineState } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { StartHexActionCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { SacrificeOptionId } from '@hexoflat/engine/skills/sacrifice-rules';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import type { KnowledgeAction, KnowledgeContext } from '@hexoflat/engine/knowledge/commands';
import type { WillZone } from '@hexoflat/engine/knowledge/will-zone';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import type { PortalLocation } from '@hexoflat/engine/portal/portal-rules';
import type { BattleState } from '@hexoflat/engine/battle/battle-state';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { ensurePresence, sendProgress } from '@/services/inventory/inventory-sync';
import {
  actOnServerWorld,
  installTravelledWorlds,
  travelOnServer,
} from '@/services/world/served-world';
import { getMeta } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type { WorldClientHint } from '@hexoflat/engine/world/server-ports';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';

export { canReachBook as isAtKnowledgeBook } from '@hexoflat/engine/knowledge/camp-book';

export interface KnowledgeHost {
  heroId: string;
  state: KnowledgeState;
  map: HexMapModel;
  context: KnowledgeContext;
  engineContext: HexEngineActionContext;
  hero: HeroState;
  location: PortalLocation;
  isCurrent(): boolean;
  clientHint(): WorldClientHint;
  applyWorldResult(result: WorldCommandResult): void;
  travelTo(locationKey: LocationKey): void;
}

async function viaServer(
  host: Omit<KnowledgeHost, 'state'>,
  type: string,
  payload: Record<string, unknown>,
) {
  if (!host.isCurrent()) return { state: inventorySession.knowledge, accepted: false };
  const { coordinates, locationKey, mapId } = host.context;
  if (coordinates) await ensurePresence({ locationKey, mapId });
  const result = await sendProgress(type, payload);
  return { state: result.knowledge, accepted: result.ok && host.isCurrent() };
}

export function dispatchKnowledge(host: KnowledgeHost, action: KnowledgeAction) {
  return viaServer(host, 'KNOWLEDGE', { action });
}

export function dispatchSkillSacrifice(
  host: KnowledgeHost,
  skillId: SkillId,
  option: SacrificeOptionId,
) {
  return viaServer(host, 'SACRIFICE_TO_SKILL', { skillId, option });
}

export function dispatchSkillsReset(host: KnowledgeHost) {
  return viaServer(host, 'RESET_SKILLS', {});
}

export async function dispatchDevWillGrant(amount: number) {
  const result = await sendProgress('DEV_GRANT_WILL', { amount });
  return result.knowledge;
}

export function locationWillZone(locationKey: LocationKey): WillZone {
  return MapRegistry.get(locationKey)?.willZone ?? 'paid';
}

export interface SquadHostState {
  battle?: BattleState;
  engagement?: Engagement;
}

function blockedGate(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
): DomainEvent | null {
  const { coordinates, actionType } = command.payload;
  if (actionType !== EHexActionType.ENTER) return null;
  const key = host.map.tiles.find(
    (tile) =>
      tile.coordinates.columnIndex === coordinates.columnIndex &&
      tile.coordinates.rowIndex === coordinates.rowIndex,
  )?.hexobject?.hexobjectKey;
  const enter = key ? getMeta(key)?.enter : undefined;
  if (enter?.type !== 'WORLD') return null;
  const world = host.engineContext.worldMap;
  const rejected = (message: string): DomainEvent => ({
    type: 'HEX_ACTION_START_REJECTED',
    payload: { coordinates, actionType, message },
  });
  if (world.combatActive) return rejected('Cannot leave the map during combat!');
  if (!world.isLocationRespawning(enter.locationKey)) return null;
  const seconds = Math.ceil(world.getLocationRespawnRemainingMs(enter.locationKey) / 1000);
  return rejected(`Opens in ${seconds}s`);
}

function enteredGate(host: Omit<KnowledgeHost, 'state'>, command: StartHexActionCommand) {
  const { coordinates } = command.payload;
  const key = host.map.tiles.find(
    (tile) =>
      tile.coordinates.columnIndex === coordinates.columnIndex &&
      tile.coordinates.rowIndex === coordinates.rowIndex,
  )?.hexobject?.hexobjectKey;
  const enter = key ? getMeta(key)?.enter : undefined;
  return enter?.type === 'WORLD' ? enter.locationKey : null;
}

export async function dispatchHexAction(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
  held: SquadHostState = {},
) {
  const known = inventorySession.knowledge;
  if (!known || !host.isCurrent()) return { state: known, events: [], hero: host.hero, held };
  const blocked = blockedGate(host, command);
  if (blocked) return { state: known, events: [blocked], hero: host.hero, held };

  const { coordinates, actionType, toolKey } = command.payload;
  const from = host.context.coordinates ?? host.hero.coordinates;
  const at = {
    locationKey: host.context.locationKey as LocationKey,
    mapId: host.context.mapId,
    from,
  };
  const gate = actionType === EHexActionType.ENTER ? enteredGate(host, command) : null;
  const result = gate
    ? await travelOnServer(at, { kind: 'gate', coordinates })
    : await actOnServerWorld(at, { coordinates, actionType, toolKey }, host.clientHint());
  const stale = !host.isCurrent();
  if (!stale) host.applyWorldResult(result);

  const events = [...result.events];
  const started = events.some((event) => event.type === 'HEX_ACTION_STARTED');
  if (started && gate && !stale) {
    installTravelledWorlds(result);
    host.travelTo(gate);
    host.engineContext.navigate?.(gate);
  }
  const engaged = events.some((event) => event.type === 'BATTLE_REQUESTED');
  const after: SquadHostState = engaged
    ? { battle: held.battle, engagement: result.engagement ?? undefined }
    : held;
  return { state: inventorySession.knowledge, events, hero: host.hero, held: after };
}
