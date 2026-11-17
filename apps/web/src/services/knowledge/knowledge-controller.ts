import type { HexEngineActionContext } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
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
import {
  ensurePresence,
  sendProgress,
  sendQuestCommand,
} from '@/services/inventory/inventory-sync';
import {
  actOnServerWorld,
  installTravelledWorlds,
  travelOnServer,
  readCachedWorld,
} from '@/services/world/served-world';
import { objectActionDestination } from '@hexoflat/engine/map/object-transition';
import { runObjectTransition, enterQuestDestination } from './object-transition-controller';
import { questRefusalText } from '@/composables/quest-messages';
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
  if (coordinates && !(await ensurePresence({ locationKey, mapId }))) {
    return { state: inventorySession.knowledge, accepted: false };
  }
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

function targetTile(host: Omit<KnowledgeHost, 'state'>, command: StartHexActionCommand) {
  const { coordinates } = command.payload;
  return host.map.tiles.find(
    (candidate) =>
      candidate.coordinates.columnIndex === coordinates.columnIndex &&
      candidate.coordinates.rowIndex === coordinates.rowIndex,
  );
}

async function executeHexAction(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
  held: SquadHostState = {},
) {
  const known = inventorySession.knowledge;
  if (!known || !host.isCurrent()) return { state: known, events: [], hero: host.hero, held };

  const { coordinates, actionType, toolKey } = command.payload;
  const from = host.context.coordinates ?? host.hero.coordinates;
  const at = {
    locationKey: host.context.locationKey as LocationKey,
    mapId: host.context.mapId,
    from,
  };
  const tile = targetTile(host, command);
  const destination = objectActionDestination(tile?.hexobject, actionType);
  if (destination?.type === 'QUEST') {
    const stored = readCachedWorld(at.locationKey);
    const questId =
      stored?.mapId === at.mapId
        ? Object.entries(stored.questEntrances ?? {}).find(
            ([, objectId]) => objectId === tile?.hexobject?.id,
          )?.[0]
        : undefined;
    const events = await enterQuestDestination(
      {
        isCurrent: () => host.isCurrent(),
        ensurePresence: () => ensurePresence(at),
        send: () =>
          questId
            ? sendQuestCommand('QUEST_ENTER', { questId }, () => host.isCurrent())
            : Promise.resolve({ ok: false as const, code: 'NOT_AT_QUEST_ENTRANCE', events: [] }),
        refusalText: questRefusalText,
      },
      coordinates,
      actionType,
    );
    return { state: inventorySession.knowledge, events, hero: host.hero, held };
  }
  const gate = destination?.type === 'WORLD' ? destination.locationKey : null;
  const result = gate
    ? await travelOnServer(at, { kind: 'gate', coordinates })
    : await actOnServerWorld(at, { coordinates, actionType, toolKey }, host.clientHint());
  const stale = !host.isCurrent();
  if (stale) return { state: inventorySession.knowledge, events: [], hero: host.hero, held };
  host.applyWorldResult(result);

  const events = [...result.events];
  const started = events.some((event) => event.type === 'HEX_ACTION_STARTED');
  if (started && gate) {
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

export function dispatchHexAction(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
  held: SquadHostState = {},
) {
  const tile = targetTile(host, command);
  if (!objectActionDestination(tile?.hexobject, command.payload.actionType))
    return executeHexAction(host, command, held);
  return runObjectTransition(
    `${host.heroId}:${host.context.mapId}`,
    () => executeHexAction(host, command, held),
    () => ({ state: inventorySession.knowledge, events: [], hero: host.hero, held }),
  );
}
