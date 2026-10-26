import type { SkillId } from './skill-content';
import { SKILLS } from './skill-content';
import { getMaxRank, getSkillRank, type SkillRanks } from './skill-rules';

export const SACRIFICE_OPTION_IDS = ['small', 'medium', 'all'] as const;
export type SacrificeOptionId = (typeof SACRIFICE_OPTION_IDS)[number];

export type SkillProgress = Partial<Record<SkillId, number>>;

export interface SacrificeOption {
  id: SacrificeOptionId;
  amount: number;
  affordable: boolean;
}

const SHARE_PERCENT = { small: 30, medium: 60 } as const;

export function getSkillProgress(progress: SkillProgress, id: SkillId): number {
  return Math.max(0, Math.floor(progress[id] ?? 0));
}

/** Three offers scaled by the hero's Will capacity: 30%, 60%, and everything held. */
export function getSacrificeOptions(capacity: number, current: number): SacrificeOption[] {
  const scaled = (percent: number) => Math.ceil((capacity * percent) / 100);
  const offers: Array<[SacrificeOptionId, number]> = [
    ['small', scaled(SHARE_PERCENT.small)],
    ['medium', scaled(SHARE_PERCENT.medium)],
    ['all', current],
  ];
  return offers.map(([id, amount]) => ({
    id,
    amount,
    affordable: amount >= 1 && amount <= current,
  }));
}

export function getSacrificeAmount(
  capacity: number,
  current: number,
  option: SacrificeOptionId,
): number | null {
  const found = getSacrificeOptions(capacity, current).find((offer) => offer.id === option);
  return found?.affordable ? found.amount : null;
}

export interface SacrificeOutcome {
  rank: number;
  progress: number;
  spent: number;
  ranksGained: number;
}

/** Pours Will into the skill bar; overflow carries to the next rank, nothing is taken past the top rank. */
export function applySacrifice(
  ranks: SkillRanks,
  progressMap: SkillProgress,
  id: SkillId,
  amount: number,
): SacrificeOutcome {
  const max = getMaxRank(id);
  const startRank = getSkillRank(ranks, id);
  let rank = startRank;
  let progress = getSkillProgress(progressMap, id);
  let remaining = amount;
  let spent = 0;

  while (remaining > 0 && rank < max) {
    const cost = SKILLS[id].rankCosts[rank];
    const put = Math.min(remaining, cost - progress);
    progress += put;
    remaining -= put;
    spent += put;
    if (progress >= cost) {
      rank++;
      progress = 0;
    }
  }
  return { rank, progress, spent, ranksGained: rank - startRank };
}
