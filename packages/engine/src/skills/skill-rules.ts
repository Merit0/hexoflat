import { SKILL_IDS, SKILLS, type SkillId } from './skill-content';

export type SkillRanks = Partial<Record<SkillId, number>>;
export type SkillBonuses = { attack: number; defense: number };

export type SkillStatus = 'max' | 'soon' | 'requires' | 'locked' | 'need-will' | 'ready';

export function getMaxRank(id: SkillId): number {
  return SKILLS[id].maxRank;
}

export function getSkillRank(skills: SkillRanks, id: SkillId): number {
  const stored = Math.floor(skills[id] ?? 0);
  return Math.min(getMaxRank(id), Math.max(0, stored, SKILLS[id].startRank));
}

export function requirementsMet(skills: SkillRanks, id: SkillId): boolean {
  return SKILLS[id].requires.every((parent) => getSkillRank(skills, parent) >= 1);
}

/** Will price of the next rank, or null once the skill is at its top rank. */
export function getNextRankCost(skills: SkillRanks, id: SkillId): number | null {
  const rank = getSkillRank(skills, id);
  return rank >= getMaxRank(id) ? null : SKILLS[id].rankCosts[rank];
}

export function getSkillStatus(
  skills: SkillRanks,
  id: SkillId,
  context: { will: number; locked: boolean },
): SkillStatus {
  if (getNextRankCost(skills, id) === null) return 'max';
  if (!SKILLS[id].implemented) return 'soon';
  if (!requirementsMet(skills, id)) return 'requires';
  if (context.locked) return 'locked';
  return context.will < 1 ? 'need-will' : 'ready';
}

/** Permanent bonuses the unlocked ranks add on top of the hero's base attack and defence. */
export function getSkillBonuses(skills: SkillRanks): SkillBonuses {
  const bonuses = { attack: 0, defense: 0 };
  for (const id of SKILL_IDS) {
    const { effect } = SKILLS[id];
    if (effect.kind === 'stat') bonuses[effect.stat] += getSkillRank(skills, id) * effect.perRank;
  }
  return {
    attack: Math.round(bonuses.attack * 100) / 100,
    defense: Math.round(bonuses.defense * 100) / 100,
  };
}

export type PortalAbility = { unlocked: false } | { unlocked: true; willCost: number };

export function getPortalAbility(skills: SkillRanks): PortalAbility {
  for (const id of SKILL_IDS) {
    const { effect } = SKILLS[id];
    if (effect.kind !== 'portal') continue;
    const rank = getSkillRank(skills, id);
    if (rank >= 1) return { unlocked: true, willCost: effect.willCostByRank[rank - 1] };
  }
  return { unlocked: false };
}
