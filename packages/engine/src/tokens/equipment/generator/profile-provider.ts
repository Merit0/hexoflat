import type { TMapTier } from '../../token-keys';
import {
  attributeProfilesSchema,
  type AttributeProfile,
  type AttributeProfiles,
} from '../attribute-profile-schema';
import type { IAttributeProfileProvider } from './generator-contracts';

export class ContentAttributeProfileProvider implements IAttributeProfileProvider {
  private readonly profiles: Readonly<AttributeProfiles>;

  constructor(profiles: AttributeProfiles) {
    const snapshot = attributeProfilesSchema.parse(profiles);
    for (const profile of Object.values(snapshot)) {
      for (const entry of Object.values(profile.attributes)) {
        Object.freeze(entry.weight);
        Object.freeze(entry);
      }
      Object.freeze(profile.attributes);
      Object.freeze(profile.countWeights);
      Object.freeze(profile);
    }
    this.profiles = Object.freeze(snapshot);
  }

  profileFor(level: TMapTier): AttributeProfile {
    const profile = this.profiles[`tier-${level}`];
    if (!profile) throw new Error(`NO_ATTRIBUTE_PROFILE: tier-${level}`);
    return profile;
  }
}
