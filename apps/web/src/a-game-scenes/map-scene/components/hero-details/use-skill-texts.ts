import { useI18n } from 'vue-i18n';
import { SKILLS, type SkillBranch, type SkillId } from '@hexoflat/engine/skills/skill-content';

const STAT_PER_RANK = 0.05;

export function useSkillTexts() {
  const i18n = useI18n();
  const { t } = i18n;

  const name = (id: SkillId) => t(`heroDetails.tree.node.${id}.name`);
  const branchName = (branch: SkillBranch) => t(`heroDetails.tree.branch.${branch}.name`);
  const branchTag = (branch: SkillBranch) => t(`heroDetails.tree.branch.${branch}.tag`);

  function effectText(id: SkillId, rank: number): string {
    const { effect } = SKILLS[id];
    const params = {
      bonus: (Math.round(rank * STAT_PER_RANK * 100) / 100).toFixed(2),
      cost: effect.kind === 'portal' ? effect.willCostByRank[rank - 1] : 0,
    };
    const key = `heroDetails.tree.node.${id}.fx`;
    const message = i18n.tm(key);
    if (!Array.isArray(message)) return t(key, params);
    const index = Math.min(rank, message.length) - 1;
    return i18n.rt(message[index] as Parameters<typeof i18n.rt>[0], params);
  }

  return { t, name, branchName, branchTag, effectText };
}
