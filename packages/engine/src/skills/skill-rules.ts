import { SKILL_IDS, SKILLS, type SkillId } from './skill-content';

export type SkillRanks = Partial<Record<SkillId, number>>;
export type SkillBonuses = Record<SkillId, number>;

export function getMaxRank(id: SkillId): number {
  return SKILLS[id].rankCosts.length;
}

export function getSkillRank(skills: SkillRanks, id: SkillId): number {
  return Math.min(getMaxRank(id), Math.max(0, Math.floor(skills[id] ?? 0)));
}

/** Will price of the next rank, or null once the skill is at its top rank. */
export function getNextRankCost(skills: SkillRanks, id: SkillId): number | null {
  const rank = getSkillRank(skills, id);
  return rank >= getMaxRank(id) ? null : SKILLS[id].rankCosts[rank];
}

/** Permanent bonuses the unlocked ranks add on top of the hero's base attack and defence. */
export function getSkillBonuses(skills: SkillRanks): SkillBonuses {
  const bonuses = { attack: 0, defense: 0 } satisfies SkillBonuses;
  for (const id of SKILL_IDS) {
    const skill = SKILLS[id];
    bonuses[skill.effect] += getSkillRank(skills, id) * skill.bonusPerRank;
  }
  return {
    attack: Math.round(bonuses.attack * 100) / 100,
    defense: Math.round(bonuses.defense * 100) / 100,
  };
}
