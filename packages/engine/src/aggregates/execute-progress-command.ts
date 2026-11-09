import type { DomainEvent } from '../commands/types';
import { applyKnowledgeCommand } from '../knowledge/reducer';
import type { KnowledgeContext } from '../knowledge/commands';
import { standsAtCampBook } from '../knowledge/camp-book';
import { MapRegistry } from '../registry/world-map-registry';
import { applyResetSkills } from '../skills/reset-skills';
import { applySacrificeToSkill } from '../skills/sacrifice-skill';
import { getMeta } from '../content/content-accessors';
import { EHexActionType } from '../enums/hex-action-type';
import { willZoneCharges } from '../knowledge/will-zone';
import { grantWill, spendWill, willRejected } from '../knowledge/will';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { getPortalAbility } from '../skills/skill-rules';
import { hexDistance } from '../utils/hex-utils';
import type { PlayerCommand } from './player-commands';
import type { Presence, ProgressState } from './progress-state';

export type ProgressOutcome =
  | { ok: true; progress: ProgressState; events: DomainEvent[] }
  | { ok: false; code: string; events: DomainEvent[] };

const REJECTED_EVENTS: ReadonlySet<string> = new Set([
  'KNOWLEDGE_REJECTED',
  'SKILL_REJECTED',
  'WILL_REJECTED',
]);

function rejection(events: readonly DomainEvent[]): ProgressOutcome | null {
  const refused = events.filter((event) => REJECTED_EVENTS.has(event.type));
  if (refused.length === 0) return null;
  const reasons = refused.map(
    (event) => (event.payload as { reason?: unknown } | undefined)?.reason,
  );
  const reason = reasons.find((value): value is string => typeof value === 'string');
  return { ok: false, code: reason ?? 'KNOWLEDGE_REJECTED', events: [...events] };
}

export function serverKnowledgeContext(presence: Presence | null): KnowledgeContext {
  const locationKey = presence?.locationKey ?? 'camping';
  return {
    locationKey,
    mapId: presence?.mapId ?? '',
    willZone: MapRegistry.get(locationKey)?.willZone ?? 'paid',
    combatActive: false,
    moving: false,
    atBook: standsAtCampBook(locationKey, presence?.coordinates ?? null),
    ...(presence ? { coordinates: presence.coordinates } : {}),
  };
}

function stepRefused(progress: ProgressState, target: { columnIndex: number; rowIndex: number }) {
  const { presence } = progress;
  return !presence || hexDistance(presence.coordinates, target) !== 1;
}

function refuse(heroId: string, reason: string, ref: string): ProgressOutcome {
  return {
    ok: false,
    code: reason,
    events: [willRejected(heroId, reason as never, ref)],
  };
}

function spendFor(
  progress: ProgressState,
  command: Extract<PlayerCommand, { type: 'SPEND_WILL' }>,
  ctx: KnowledgeContext,
): ProgressOutcome {
  const { heroId, revision, spend } = command.payload;
  const { knowledge } = progress;
  const ref =
    spend.kind === 'action'
      ? `${spend.actionType}:${spend.coordinates.columnIndex}:${spend.coordinates.rowIndex}`
      : `portal:${spend.target.columnIndex}:${spend.target.rowIndex}`;
  if (heroId !== knowledge.heroId) return refuse(heroId, 'WRONG_HERO', ref);
  if (revision !== knowledge.revision) return refuse(heroId, 'STALE_REVISION', ref);

  let cost: number;
  let reason: 'action' | 'entry';
  if (spend.kind === 'action') {
    const price =
      getMeta(spend.hexobjectKey as THexobjectKey).actions?.[spend.actionType]?.willCost ?? 0;
    cost = price > 0 && willZoneCharges(ctx) ? price : 0;
    reason = spend.actionType === EHexActionType.ENTER ? 'entry' : 'action';
  } else {
    if (ctx.locationKey === 'camping') return refuse(heroId, 'IN_CAMPING', ref);
    const ability = getPortalAbility(knowledge.skills);
    if (!ability.unlocked) return refuse(heroId, 'NOT_AN_ANGEL', ref);
    cost = ability.willCost;
    reason = 'action';
  }
  if (cost === 0) return { ok: true, progress, events: [] };

  const spent = spendWill(knowledge, cost, reason, ref);
  if (!spent.ok) return { ok: false, code: 'INSUFFICIENT_WILL', events: spent.events };
  knowledge.revision += 1;
  return { ok: true, progress, events: spent.events };
}

export function executeProgressCommand(
  progress: ProgressState,
  command: PlayerCommand,
  devAllowed = false,
): ProgressOutcome | null {
  const next: ProgressState = structuredClone(progress);
  const ctx = serverKnowledgeContext(next.presence);
  let events: DomainEvent[];
  switch (command.type) {
    case 'ARRIVE': {
      const { locationKey, mapId, coordinates } = command.payload;
      next.presence = { locationKey, mapId, coordinates };
      return {
        ok: true,
        progress: next,
        events: [
          { type: 'HERO_ARRIVED', payload: { heroId: command.payload.heroId, locationKey, mapId } },
        ],
      };
    }
    case 'KNOWLEDGE': {
      const { action } = command.payload;
      if (action.kind === 'step' && (!action.target || stepRefused(next, action.target))) {
        return {
          ok: false,
          code: 'INVALID_STEP',
          events: [
            {
              type: 'KNOWLEDGE_REJECTED',
              payload: { heroId: command.payload.heroId, reason: 'INVALID_STEP' },
            },
          ],
        };
      }
      events = applyKnowledgeCommand(next.knowledge, command, ctx);
      if (action.kind === 'step' && action.target && !rejection(events)) {
        next.presence = next.presence && { ...next.presence, coordinates: { ...action.target } };
        next.steps += 1;
      }
      break;
    }
    case 'SACRIFICE_TO_SKILL':
      events = applySacrificeToSkill(next.knowledge, ctx, command.payload);
      break;
    case 'RESET_SKILLS':
      events = applyResetSkills(next.knowledge, ctx, command.payload);
      break;
    case 'SPEND_WILL':
      return spendFor(next, command, ctx);
    case 'DEV_GRANT_WILL': {
      if (!devAllowed) return { ok: false, code: 'FORBIDDEN', events: [] };
      const { heroId, revision, amount } = command.payload;
      if (heroId !== next.knowledge.heroId || revision !== next.knowledge.revision) {
        return { ok: false, code: 'STALE_REVISION', events: [] };
      }
      events = grantWill(next.knowledge, amount, { kind: 'dev', ref: 'dev' });
      if (events.length === 0) return { ok: true, progress, events: [] };
      next.knowledge.revision += 1;
      return { ok: true, progress: next, events };
    }
    case 'DEV_SET_KNOWLEDGE': {
      if (!devAllowed) return { ok: false, code: 'FORBIDDEN', events: [] };
      const { heroId, revision, knowledge } = command.payload;
      if (heroId !== next.knowledge.heroId || revision !== next.knowledge.revision) {
        return { ok: false, code: 'STALE_REVISION', events: [] };
      }
      next.knowledge = { ...knowledge, heroId, revision: revision + 1 };
      return {
        ok: true,
        progress: next,
        events: [{ type: 'KNOWLEDGE_REPLACED', payload: { heroId } }],
      };
    }
    default:
      return null;
  }
  return rejection(events) ?? { ok: true, progress: next, events };
}
