import { applyCommand, type HexEngineActionContext, type HexEngineState } from '@hexoflat/engine';
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
import { inventorySession, type ServerPresence } from '@/services/inventory/inventory-session';

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
}

function presenceOf(host: Omit<KnowledgeHost, 'state'>): ServerPresence | null {
  const { coordinates, locationKey, mapId } = host.context;
  return coordinates ? { locationKey, mapId, coordinates: { ...coordinates } } : null;
}

async function viaServer(
  host: Omit<KnowledgeHost, 'state'>,
  type: string,
  payload: Record<string, unknown>,
) {
  if (!host.isCurrent()) return { state: inventorySession.knowledge, accepted: false };
  await ensurePresence(presenceOf(host));
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

export async function dispatchHexAction(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
  held: SquadHostState = {},
) {
  let events: DomainEvent[] = [];
  let after: SquadHostState = held;
  const known = inventorySession.knowledge;
  if (!known || !host.isCurrent()) return { state: known, events, hero: host.hero, held: after };

  await ensurePresence(presenceOf(host));
  const { coordinates, actionType } = command.payload;
  const hexobjectKey = host.map.tiles.find(
    (tile) =>
      tile.coordinates.columnIndex === coordinates.columnIndex &&
      tile.coordinates.rowIndex === coordinates.rowIndex,
  )?.hexobject?.hexobjectKey;

  const working = structuredClone(inventorySession.knowledge ?? known);
  const world: HexEngineState = {
    map: host.map,
    heroes: { [host.hero.id]: host.hero },
    knowledge: working,
    knowledgeContext: host.context,
    location: host.location,
    battle: held.battle,
    engagement: held.engagement,
  };
  events = applyCommand(world, command, host.engineContext).events;
  after = { battle: world.battle, engagement: world.engagement };

  if (events.some((event) => event.type === 'WILL_SPENT') && hexobjectKey) {
    const result = await sendProgress('SPEND_WILL', {
      spend: { kind: 'action', hexobjectKey, actionType, coordinates: { ...coordinates } },
    });
    return { state: result.knowledge, events, hero: host.hero, held: after };
  }
  return { state: inventorySession.knowledge, events, hero: host.hero, held: after };
}
