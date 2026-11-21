import type { AttributeProfiles } from '../attribute-profile-schema';
import type { EquipmentAttributeDefinition } from '../equipment-attribute-schema';
import { WeightedCountRoller } from './count-roller';
import {
  EquipmentAttributeGenerator,
  type EquipmentAttributeGeneratorParts,
} from './equipment-attribute-generator';
import { RegistryAttributePoolFilter } from './pool-filter';
import { ContentAttributeProfileProvider } from './profile-provider';
import { SteppedValueRoller } from './value-roller';
import { CumulativeWeightedPicker } from './weighted-picker';

export function createEquipmentAttributeGenerator(
  attributes: readonly EquipmentAttributeDefinition[],
  profiles: AttributeProfiles,
  overrides: Partial<EquipmentAttributeGeneratorParts> = {},
): EquipmentAttributeGenerator {
  const picker = overrides.picker ?? new CumulativeWeightedPicker();
  return new EquipmentAttributeGenerator({
    profiles: overrides.profiles ?? new ContentAttributeProfileProvider(profiles),
    pool: overrides.pool ?? new RegistryAttributePoolFilter(attributes),
    counts: overrides.counts ?? new WeightedCountRoller(picker),
    picker,
    values: overrides.values ?? new SteppedValueRoller(),
  });
}
