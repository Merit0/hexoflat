import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useItemTooltipLabels() {
  const { t } = useI18n();
  return computed(() => ({
    rarity: {
      basic: t('itemTooltip.rarity.basic'),
      common: t('itemTooltip.rarity.common'),
      rare: t('itemTooltip.rarity.rare'),
      legend: t('itemTooltip.rarity.legend'),
      mythic: t('itemTooltip.rarity.mythic'),
    },
    group: {
      resource: t('itemTooltip.group.resource'),
      creature: t('itemTooltip.group.creature'),
      tool: t('itemTooltip.group.tool'),
      construction: t('itemTooltip.group.construction'),
      loot: t('itemTooltip.group.loot'),
      equipment: t('itemTooltip.group.equipment'),
    },
    slot: {
      weapon: t('itemTooltip.slot.weapon'),
      shield: t('itemTooltip.slot.shield'),
      armor: t('itemTooltip.slot.armor'),
      gloves: t('itemTooltip.slot.gloves'),
      helm: t('itemTooltip.slot.helm'),
      boots: t('itemTooltip.slot.boots'),
      ring: t('itemTooltip.slot.ring'),
      amulet: t('itemTooltip.slot.amulet'),
    },
    headline: {
      damage: t('itemTooltip.headline.damage'),
      defense: t('itemTooltip.headline.defense'),
      multiplier: t('itemTooltip.headline.multiplier'),
    },
    capability: {
      cut: t('itemTooltip.capability.cut'),
      mine: t('itemTooltip.capability.mine'),
      pickup: t('itemTooltip.capability.pickup'),
      enter: t('itemTooltip.capability.enter'),
      use: t('itemTooltip.capability.use'),
      open: t('itemTooltip.capability.open'),
      attack: t('itemTooltip.capability.attack'),
      block: t('itemTooltip.capability.block'),
    },
  }));
}
