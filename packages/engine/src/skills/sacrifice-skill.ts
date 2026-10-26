import type { DomainEvent } from '../commands/types';
import type { KnowledgeContext } from '../knowledge/commands';
import type { KnowledgeState } from '../knowledge/state';
import { spendWill, willRejected } from '../knowledge/will';
import type { SkillId } from './skill-content';
import { SKILLS } from './skill-content';
import { applySacrifice, getSacrificeAmount, type SacrificeOptionId } from './sacrifice-rules';
import { getNextRankCost, requirementsMet } from './skill-rules';

export type SkillRejectReason =
  | 'WRONG_HERO'
  | 'STALE_REVISION'
  | 'IN_COMBAT'
  | 'MOVING'
  | 'MAX_RANK'
  | 'NOT_AVAILABLE_YET'
  | 'REQUIREMENTS_NOT_MET'
  | 'INSUFFICIENT_WILL';

export interface SacrificeSkillPayload {
  heroId: string;
  revision: number;
  skillId: SkillId;
  option: SacrificeOptionId;
}

function rejected(payload: SacrificeSkillPayload, reason: SkillRejectReason): DomainEvent {
  return {
    type: 'SKILL_REJECTED',
    payload: { heroId: payload.heroId, skillId: payload.skillId, reason },
  };
}

function preconditionFailure(
  state: KnowledgeState,
  ctx: KnowledgeContext,
  payload: SacrificeSkillPayload,
): SkillRejectReason | null {
  if (payload.heroId !== state.heroId) return 'WRONG_HERO';
  if (payload.revision !== state.revision) return 'STALE_REVISION';
  if (ctx.combatActive) return 'IN_COMBAT';
  if (ctx.moving) return 'MOVING';
  return null;
}

function skillFailure(state: KnowledgeState, skillId: SkillId): SkillRejectReason | null {
  if (getNextRankCost(state.skills, skillId) === null) return 'MAX_RANK';
  if (!SKILLS[skillId].implemented) return 'NOT_AVAILABLE_YET';
  if (!requirementsMet(state.skills, skillId)) return 'REQUIREMENTS_NOT_MET';
  return null;
}

export function applySacrificeToSkill(
  state: KnowledgeState,
  ctx: KnowledgeContext,
  payload: SacrificeSkillPayload,
): DomainEvent[] {
  const failure = preconditionFailure(state, ctx, payload) ?? skillFailure(state, payload.skillId);
  if (failure) return [rejected(payload, failure)];

  const { skillId, option } = payload;
  const offered = getSacrificeAmount(state.capacity, state.current, option);
  if (offered === null) {
    return [
      rejected(payload, 'INSUFFICIENT_WILL'),
      willRejected(state.heroId, 'INSUFFICIENT_WILL', skillId),
    ];
  }

  const outcome = applySacrifice(state.skills, state.skillProgress, skillId, offered);
  const spent = spendWill(state, outcome.spent, 'skill', skillId);
  state.skills[skillId] = outcome.rank;
  state.skillProgress[skillId] = outcome.progress;
  state.revision++;
  return [
    {
      type: 'SKILL_SACRIFICED',
      payload: {
        heroId: state.heroId,
        skillId,
        option,
        amount: outcome.spent,
        progress: outcome.progress,
        rank: outcome.rank,
        ranksGained: outcome.ranksGained,
        revision: state.revision,
      },
    },
    ...spent.events,
  ];
}
