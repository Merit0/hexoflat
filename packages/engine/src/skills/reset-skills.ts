import type { DomainEvent } from '../commands/types';
import type { KnowledgeContext } from '../knowledge/commands';
import type { KnowledgeState } from '../knowledge/state';
import { preconditionFailure, type SkillRejectReason } from './sacrifice-skill';
import { SKILL_IDS } from './skill-content';
import { getSkillRank } from './skill-rules';

export interface ResetSkillsPayload {
  heroId: string;
  revision: number;
}

export type ResetRejectReason = SkillRejectReason | 'NOTHING_TO_RESET';

function rejected(payload: ResetSkillsPayload, reason: ResetRejectReason): DomainEvent {
  return { type: 'SKILL_REJECTED', payload: { heroId: payload.heroId, reason } };
}

export function hasSkillsToReset(state: Pick<KnowledgeState, 'skills' | 'skillProgress'>): boolean {
  return SKILL_IDS.some(
    (id) =>
      (state.skillProgress[id] ?? 0) > 0 || getSkillRank(state.skills, id) > getSkillRank({}, id),
  );
}

/** Clears every rank and bar. The sacrificed Will is gone for good; it is not refunded. */
export function applyResetSkills(
  state: KnowledgeState,
  ctx: KnowledgeContext,
  payload: ResetSkillsPayload,
): DomainEvent[] {
  const failure = preconditionFailure(state, ctx, payload);
  if (failure) return [rejected(payload, failure)];
  if (!hasSkillsToReset(state)) return [rejected(payload, 'NOTHING_TO_RESET')];

  state.skills = {};
  state.skillProgress = {};
  state.revision++;
  return [{ type: 'SKILLS_RESET', payload: { heroId: state.heroId, revision: state.revision } }];
}
