import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useHeroDetailsLabels() {
  const { t } = useI18n();
  return computed(() => ({
    vitals: {
      hearts: t('heroDetails.vitals.hearts'),
      shields: t('heroDetails.vitals.shields'),
      will: t('heroDetails.vitals.will'),
    },
    stat: {
      attack: t('heroDetails.stat.attack'),
      defense: t('heroDetails.stat.defense'),
      load: t('heroDetails.stat.load'),
      victories: t('heroDetails.stat.victories'),
    },
    skill: {
      title: {
        attack: t('heroDetails.skill.title.attack'),
        defense: t('heroDetails.skill.title.defense'),
      },
      bonus: {
        attack: t('heroDetails.skill.bonus.attack'),
        defense: t('heroDetails.skill.bonus.defense'),
      },
      rank: t('heroDetails.skill.rank'),
      unlock: t('heroDetails.skill.unlock'),
      will: t('heroDetails.skill.will'),
      max: t('heroDetails.skill.max'),
      needWill: t('heroDetails.skill.needWill'),
      locked: t('heroDetails.skill.locked'),
    },
    hands: {
      right: t('heroDetails.hands.right'),
      left: t('heroDetails.hands.left'),
      empty: t('heroDetails.hands.empty'),
    },
  }));
}
