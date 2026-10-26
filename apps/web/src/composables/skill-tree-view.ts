import { SKILLS, type SkillBranch, type SkillId } from '@hexoflat/engine/skills/skill-content';
import {
  getMaxRank,
  getNextRankCost,
  getSkillRank,
  getSkillStatus,
  requirementsMet,
  type SkillRanks,
  type SkillStatus,
} from '@hexoflat/engine/skills/skill-rules';

export type { SkillStatus };

export const SKILL_BRANCH_ORDER: readonly SkillBranch[] = ['demonic', 'bionic', 'angelic'];

export interface SkillNodeView {
  id: SkillId;
  branch: SkillBranch;
  rank: number;
  maxRank: number;
  nextCost: number | null;
  status: SkillStatus;
  parentLit: boolean;
}

export interface BranchView {
  id: SkillBranch;
  crest: SkillNodeView;
  rows: Array<[SkillNodeView, SkillNodeView]>;
  cap: SkillNodeView;
  forkLit: boolean;
  capLit: boolean;
}

export interface SkillTreeView {
  branches: BranchView[];
}

const ROW_SLOTS = [
  ['1L', '1R'],
  ['2L', '2R'],
  ['3L', '3R'],
] as const;

function idAt(branch: SkillBranch, slot: string): SkillId {
  const found = Object.values(SKILLS).find((s) => s.branch === branch && s.slot === slot);
  if (!found) throw new Error(`Skill tree has no ${branch}/${slot} node`);
  return found.id;
}

export function buildSkillTreeView(
  ranks: SkillRanks,
  will: number,
  locked: boolean,
): SkillTreeView {
  const node = (id: SkillId): SkillNodeView => ({
    id,
    branch: SKILLS[id].branch,
    rank: getSkillRank(ranks, id),
    maxRank: getMaxRank(id),
    nextCost: getNextRankCost(ranks, id),
    status: getSkillStatus(ranks, id, { will, locked }),
    parentLit: requirementsMet(ranks, id),
  });

  const branches = SKILL_BRANCH_ORDER.map((branch): BranchView => {
    const crest = node(idAt(branch, 'crest'));
    const cap = node(idAt(branch, 'cap'));
    return {
      id: branch,
      crest,
      rows: ROW_SLOTS.map(([l, r]) => [node(idAt(branch, l)), node(idAt(branch, r))]),
      cap,
      forkLit: crest.rank >= 1,
      capLit: cap.parentLit,
    };
  });
  return { branches };
}

export function findSkillNode(view: SkillTreeView, id: SkillId): SkillNodeView | null {
  for (const branch of view.branches) {
    const nodes = [branch.crest, ...branch.rows.flat(), branch.cap];
    const found = nodes.find((n) => n.id === id);
    if (found) return found;
  }
  return null;
}
