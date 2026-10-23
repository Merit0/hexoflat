import type { DomainEvent } from '../commands/types';
import type { KnowledgeContext } from '../knowledge/commands';
import type { KnowledgeState } from '../knowledge/state';
import { spendWill } from '../knowledge/will';
import type { SkillId } from './skill-content';
import { getNextRankCost, getSkillRank } from './skill-rules';

export type SkillRejectReason =
  'WRONG_HERO' | 'STALE_REVISION' | 'IN_COMBAT' | 'MOVING' | 'MAX_RANK' | 'INSUFFICIENT_WILL';

export interface UnlockSkillPayload {
  heroId: string;
  revision: number;
  skillId: SkillId;
}

function rejected(payload: UnlockSkillPayload, reason: SkillRejectReason): DomainEvent {
  return {
    type: 'SKILL_REJECTED',
    payload: { heroId: payload.heroId, skillId: payload.skillId, reason },
  };
}

function preconditionFailure(
  state: KnowledgeState,
  ctx: KnowledgeContext,
  payload: UnlockSkillPayload,
): SkillRejectReason | null {
  if (payload.heroId !== state.heroId) return 'WRONG_HERO';
  if (payload.revision !== state.revision) return 'STALE_REVISION';
  if (ctx.combatActive) return 'IN_COMBAT';
  if (ctx.moving) return 'MOVING';
  return null;
}

export function applyUnlockSkill(
  state: KnowledgeState,
  ctx: KnowledgeContext,
  payload: UnlockSkillPayload,
): DomainEvent[] {
  const failure = preconditionFailure(state, ctx, payload);
  if (failure) return [rejected(payload, failure)];

  const cost = getNextRankCost(state.skills, payload.skillId);
  if (cost === null) return [rejected(payload, 'MAX_RANK')];

  const spent = spendWill(state, cost, 'skill', payload.skillId);
  if (!spent.ok) return [rejected(payload, 'INSUFFICIENT_WILL'), ...spent.events];

  const rank = getSkillRank(state.skills, payload.skillId) + 1;
  state.skills[payload.skillId] = rank;
  state.revision++;
  return [
    {
      type: 'SKILL_UNLOCKED',
      payload: {
        heroId: state.heroId,
        skillId: payload.skillId,
        rank,
        cost,
        revision: state.revision,
      },
    },
    ...spent.events,
  ];
}
